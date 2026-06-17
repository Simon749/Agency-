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

interface InitiatePaymentInput {
    tenantId: string;
    buildingId: string;
    phone: string;
    amount: number;
    unitNumber: string;
}

export async function initiatePayment(input: InitiatePaymentInput) {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, error: "Not authenticated" };
    }

    const db = getDb();

    // Verify tenant belongs to signed-in user
    const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

    if (!tenant || tenant.clerkUserId !== userId) {
        return { success: false, error: "Unauthorized" };
    }

    // Double-check balance
    const balance = await getTenantBalance(input.tenantId);
    if (balance.balance <= 0) {
        return { success: false, error: "No outstanding balance" };
    }

    const billingMonth = new Date().toISOString().slice(0, 7); // "2026-06"
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mpesa/${tenant.buildingId}`;

    try {
        const stkResponse = await initiateStkPush({
            buildingId: input.buildingId,
            tenantId: input.tenantId,
            phone: input.phone,
            amount: Math.min(input.amount, balance.balance), // don't overcharge
            accountReference: input.tenantId,
            transactionDesc: `Rent ${billingMonth} - Unit ${input.unitNumber}`,
            callbackUrl,
        });

        // Record pending transaction
        await db.insert(pendingTransactions).values({
            tenantId: input.tenantId,
            agencyId: tenant.agencyId,
            buildingId: input.buildingId,
            checkoutRequestId: stkResponse.CheckoutRequestID,
            merchantRequestId: stkResponse.MerchantRequestID,
            amount: Math.min(input.amount, balance.balance).toString(),
            phone: formatPhoneForDaraja(input.phone),  // ← was phoneNumber
            status: 'PENDING',
        });

        revalidatePath("/tenant/pay");
        revalidatePath("/tenant/dashboard");

        return {
            success: true,
            message: stkResponse.CustomerMessage ?? "Check your phone for the M-Pesa prompt.",
        };


    } catch (err) {
        console.error("STK Push error:", err);
        return {
            success: false as const,
            error: err instanceof Error ? err.message : "Failed to initiate payment",
        };
    }
}