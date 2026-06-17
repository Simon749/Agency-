// lib/ledger.ts
// Tenant balance calculation and ledger operations

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger, pendingTransactions } from "@/db/schema";
import type { InsertTenantLedgerEntry } from "@/db/schema";

export interface BalanceResult {
  totalCharged: number;
  totalPaid: number;
  balance: number; // positive = owes money
}

/**
 * Calculate tenant balance from all ledger entries.
 * Never store balance — always compute on read.
 */
export async function getTenantBalance(tenantId: string): Promise<BalanceResult> {
  const db = getDb();
  const rows = await db
    .select({ type: tenantLedger.type, amount: tenantLedger.amount })
    .from(tenantLedger)
    .where(eq(tenantLedger.tenantId, tenantId));

  let totalCharged = 0;
  let totalPaid = 0;

  for (const row of rows) {
    const amt = parseFloat(row.amount as unknown as string);
    if (row.type === "DEBIT") totalCharged += amt;
    else if (row.type === "CREDIT") totalPaid += amt;
  }

  return {
    totalCharged,
    totalPaid,
    balance: totalCharged - totalPaid,
  };
}

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
      type: 'CREDIT',
      category: entry.category ?? 'RENT',
      method: entry.method ?? 'MPESA_STK',  // ← was paymentMethod
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