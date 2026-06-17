// lib/ledger/payments.ts
// Payment-related ledger operations (from Week 5)

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger, pendingTransactions } from "@/db/schema";
import type { InsertTenantLedgerEntry } from "@/db/schema";

/**
 * Insert a CREDIT entry into tenant_ledger from an M-Pesa payment.
 * Idempotent: checks if referenceCode already exists.
 */
export async function insertPaymentCredit(
  entry: Omit<InsertTenantLedgerEntry, "id" | "createdAt" | "type">
): Promise<{ success: boolean; ledgerId?: string; alreadyExists?: boolean }> {
  const db = getDb();

  // Idempotency check
  if (entry.referenceCode) {
    const existing = await db
      .select({ id: tenantLedger.id })
      .from(tenantLedger)
      .where(eq(tenantLedger.referenceCode, entry.referenceCode))
      .limit(1);

    if (existing.length > 0) {
      return { success: true, alreadyExists: true, ledgerId: existing[0].id };
    }
  }

  const [result] = await db
    .insert(tenantLedger)
    .values({
      ...entry,
      type: "CREDIT",
      category: entry.category ?? "RENT",
      method: entry.method ?? "MPESA_STK",
    } as InsertTenantLedgerEntry)
    .returning({ id: tenantLedger.id });

  return { success: true, ledgerId: result.id };
}

/**
 * Get a pending transaction by CheckoutRequestID.
 */
export async function getPendingTransaction(checkoutRequestId: string) {
  const db = getDb();
  const [tx] = await db
    .select()
    .from(pendingTransactions)
    .where(eq(pendingTransactions.checkoutRequestId, checkoutRequestId))
    .limit(1);
  return tx ?? null;
}

/**
 * Update pending transaction status after callback.
 */
export async function updatePendingTransaction(
  checkoutRequestId: string,
  updates: {
    status: "COMPLETED" | "FAILED" | "REJECTED";
    resultCode?: string;
    resultDesc?: string;
    mpesaReceiptNumber?: string;
  }
) {
  const db = getDb();
  await db
    .update(pendingTransactions)
    .set({
      ...updates,
      completedAt: new Date(),
    })
    .where(eq(pendingTransactions.checkoutRequestId, checkoutRequestId));
}