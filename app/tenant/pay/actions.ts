// app/tenant/pay/actions.ts
"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, pendingTransactions } from "@/db/schema";
import { getTenantBalance } from "@/lib/ledger";
import { initiateStkPush } from "@/lib/daraja/client";
import { formatPhoneForDaraja } from "@/lib/daraja/utils";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { checkActionRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { headers } from "next/headers";

interface InitiatePaymentInput {
  tenantId: string;
  buildingId: string;
  agencyId: string;   // Required for getTenantBalance (agency-scoped)
  phone: string;
  amount: number;
  unitNumber: string;
}

function mapInternalErrorToUserMessage(error: string): string {
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

  // ── Rate Limit: STK Push per tenant (30s window, 1 max) ──
  const stkLimit = await checkActionRateLimit(
    `stk:${input.tenantId}`,
    RATE_LIMITS.stkPush
  );
  if (!stkLimit.allowed) {
    return {
      success: false,
      error: `Please wait ${stkLimit.retryAfter}s before requesting another STK Push.`,
    };
  }

  // ── Rate Limit: per IP (60s window, 100 max) ──
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown";
  const ipLimit = await checkActionRateLimit(
    `ip:${ip}`,
    RATE_LIMITS.public
  );
  if (!ipLimit.allowed) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  const db = getDb();
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant || tenant.clerkUserId !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  // ── Check balance (agency-scoped) ──
  const balance = await getTenantBalance(input.tenantId, input.agencyId);
  if (balance.balance <= 0) {
    return { success: false, error: "No outstanding balance" };
  }

  const billingMonth = new Date().toISOString().slice(0, 7);
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mpesa/${tenant.buildingId}`;

  try {
    const stkResponse = await initiateStkPush({
      buildingId: input.buildingId,
      tenantId: input.tenantId,
      phone: input.phone,
      amount: Math.min(input.amount, balance.balance),
      accountReference: input.tenantId,
      transactionDesc: `Rent ${billingMonth} - Unit ${input.unitNumber}`,
      callbackUrl,
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

    return {
      success: true,
      message: stkResponse.CustomerMessage ?? "Check your phone for the M-Pesa prompt.",
    };
  } catch (err) {
    console.error("STK Push error:", err);
    const rawMsg = err instanceof Error ? err.message : "Failed to initiate payment";
    return { success: false, error: mapInternalErrorToUserMessage(rawMsg) };
  }
}