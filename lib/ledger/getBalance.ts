// lib/ledger/getBalance.ts
// Calculate tenant balance from all ledger entries — append-only, never store balance

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger } from "@/db/schema";

export interface BalanceResult {
  totalCharged: number;
  totalPaid: number;
  balance: number; // positive = owes money, negative = overpaid
}

/**
 * Calculate tenant balance from all ledger entries.
 * Never store a current_balance column — always compute on read.
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