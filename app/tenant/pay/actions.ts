// app/(tenant)/pay/actions.ts
"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, pendingTransactions } from "@/db/schema";
import { getTenantBalance } from "@/lib/ledger";
import { initiateStkPush } from "@/lib/daraja/client";
import { formatPhoneForDaraja } from "@/lib/daraja/utils";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit, RateLimitKeys, STK_PUSH_CONFIG } from "@/lib/rate-limit";
import { headers } from "next/headers";

interface InitiatePaymentInput {
  tenantId: string; buildingId: string; phone: string;
  amount: number; unitNumber: string;
}

function mapInternalErrorToUserMessage(error: string): string {
  // Don't leak internal details to the tenant
  if (error.includes("Daraja credentials not configured"))
    return "M-Pesa is temporarily unavailable. Please try again later.";
  if (error.includes("Daraja token error") || error.includes("401") || error.includes("403"))
    return "M-Pesa service is experiencing issues. Please try again in a few minutes.";
  if (error.includes("shortcode") || error.includes("passkey"))
    return "Payment configuration error. Please contact your property manager.";
  if (error.includes("already pending"))
    return "A payment is already in progress. Please check your phone.";
  if (error.includes("STK Push failed"))
    return "M-Pesa is temporarily unavailable. Please try again later.";
  if (error.includes("STK Push rejected"))
    return "M-Pesa rejected the payment request. Please try again.";
  return "Payment could not be initiated. Please try again or contact support.";
}

export async function initiatePayment(input: InitiatePaymentInput) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const rateLimit = checkRateLimit(RateLimitKeys.stkPush(input.tenantId), STK_PUSH_CONFIG);
  if (rateLimit.limited) {
    return { success: false, error: `Please wait ${rateLimit.retryAfter}s before requesting another STK Push.` };
  }

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown";
  const ipLimit = checkRateLimit(RateLimitKeys.perIp(ip), { windowMs: 60_000, maxRequests: 100 });
  if (ipLimit.limited) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  const db = getDb();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
  if (!tenant || tenant.clerkUserId !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  const balance = await getTenantBalance(input.tenantId);
  if (balance.balance <= 0) return { success: false, error: "No outstanding balance" };

  const billingMonth = new Date().toISOString().slice(0, 7);
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mpesa/${tenant.buildingId}`;

  try {
    const stkResponse = await initiateStkPush({
      buildingId: input.buildingId, tenantId: input.tenantId, phone: input.phone,
      amount: Math.min(input.amount, balance.balance),
      accountReference: input.tenantId, transactionDesc: `Rent ${billingMonth} - Unit ${input.unitNumber}`, callbackUrl,
    });

    await db.insert(pendingTransactions).values({
      tenantId: input.tenantId,
      agencyId: tenant.agencyId,
      buildingId: input.buildingId,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      merchantRequestId: stkResponse.MerchantRequestID,
      amount: Math.min(input.amount, balance.balance).toString(),
      phone: formatPhoneForDaraja(input.phone),
      status: "PENDING",
    });

    revalidatePath("/tenant/pay");
    revalidatePath("/tenant/dashboard");

    return { success: true, message: stkResponse.CustomerMessage ?? "Check your phone for the M-Pesa prompt." };
  } catch (err) {
    console.error("STK Push error:", err);
    const rawMsg = err instanceof Error ? err.message : "Failed to initiate payment";
    return { success: false, error: mapInternalErrorToUserMessage(rawMsg) };
  }
}