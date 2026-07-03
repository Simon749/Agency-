// lib/ledger.ts
// PHASE 3 FIX: Transaction-wrapped inserts with proper idempotency

import { sql, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger, pendingTransactions } from "@/db/schema";
import type { InsertTenantLedgerEntry } from "@/db/schema";

export {
  getTenantStatement,
  getRecentLedgerEntries,
  getMonthlySummary,
  type StatementRow,
  type MonthlyGroup,
} from "./ledger/getStatement";

export interface BalanceResult {
  totalCharged: number;
  totalPaid: number;
  balance: number;
}

export async function getTenantBalance(tenantId: string) {
  const db = getDb();
  const [result] = await db
    .select({
      totalCharged: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount} ELSE 0 END), 0)`,
      totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount} ELSE 0 END), 0)`,
    })
    .from(tenantLedger)
    .where(eq(tenantLedger.tenantId, tenantId));
  const totalCharged = Number(result.totalCharged);
  const totalPaid = Number(result.totalPaid);
  return { totalCharged, totalPaid, balance: totalCharged - totalPaid };
}

export async function insertPaymentCredit(
  entry: Omit<InsertTenantLedgerEntry, "id" | "createdAt" | "type">
): Promise<{ success: boolean; ledgerId?: string; alreadyExists?: boolean }> {
  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      if (entry.referenceCode) {
        const referenceCode = entry.referenceCode;
        const [pendingTx] = await tx
          .select({ id: pendingTransactions.id, status: pendingTransactions.status })
          .from(pendingTransactions)
          .where(eq(pendingTransactions.checkoutRequestId, referenceCode))
          .for("update")
          .limit(1);
        if (pendingTx?.status === "COMPLETED") {
          const [existingLedger] = await tx
            .select({ id: tenantLedger.id })
            .from(tenantLedger)
            .where(eq(tenantLedger.referenceCode, referenceCode))
            .limit(1);
          return { success: true, alreadyExists: true, ledgerId: existingLedger?.id };
        }
      }
      if (entry.referenceCode) {
        const referenceCode = entry.referenceCode;
        const [existing] = await tx
          .select({ id: tenantLedger.id })
          .from(tenantLedger)
          .where(eq(tenantLedger.referenceCode, referenceCode))
          .limit(1);
        if (existing) return { success: true, alreadyExists: true, ledgerId: existing.id };
      }
      const [inserted] = await tx
        .insert(tenantLedger)
        .values({
          ...entry,
          type: "CREDIT",
          category: entry.category ?? "RENT",
          method: entry.method ?? "MPESA_STK",
        } as InsertTenantLedgerEntry)
        .returning({ id: tenantLedger.id });
      return { success: true, ledgerId: inserted.id };
    });
    return result;
  } catch (err: any) {
    if ((err.code === "23505" || err.message?.includes("unique constraint")) && entry.referenceCode) {
      const [existing] = await db
        .select({ id: tenantLedger.id })
        .from(tenantLedger)
        .where(eq(tenantLedger.referenceCode, entry.referenceCode))
        .limit(1);
      return { success: true, alreadyExists: true, ledgerId: existing?.id };
    }
    console.error("[LEDGER] Insert failed:", err);
    throw err;
  }
}

export async function insertLedgerBatch(
  entries: Array<Omit<InsertTenantLedgerEntry, "id" | "createdAt">>
): Promise<{ inserted: number; skipped: number }> {
  const db = getDb();
  if (entries.length === 0) return { inserted: 0, skipped: 0 };
  return db.transaction(async (tx) => {
    const refCodes = entries.map((e) => e.referenceCode).filter(Boolean) as string[];
    let existingIds = new Set<string>();
    if (refCodes.length > 0) {
      const existing = await tx
        .select({ ref: tenantLedger.referenceCode })
        .from(tenantLedger)
        .where(sql`${tenantLedger.referenceCode} IN (${sql.join(refCodes.map((code) => sql`${code}`), sql`, `)})`);
      // filter out possible null refs before creating the Set
      existingIds = new Set(existing.map((e) => e.ref).filter((r): r is string => r != null));
    }
    const toInsert = entries.filter((e) => !existingIds.has(e.referenceCode ?? ""));
    if (toInsert.length > 0) {
      await tx.insert(tenantLedger).values(toInsert as InsertTenantLedgerEntry[]);
    }
    return { inserted: toInsert.length, skipped: entries.length - toInsert.length };
  });
}

export async function getPendingTransaction(checkoutRequestId: string) {
  const db = getDb();
  const [tx] = await db
    .select()
    .from(pendingTransactions)
    .where(eq(pendingTransactions.checkoutRequestId, checkoutRequestId))
    .limit(1);
  return tx ?? null;
}

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
  await db.transaction(async (tx) => {
    await tx
      .select({ id: pendingTransactions.id })
      .from(pendingTransactions)
      .where(eq(pendingTransactions.checkoutRequestId, checkoutRequestId))
      .for("update")
      .limit(1);
    await tx
      .update(pendingTransactions)
      .set({ ...updates, completedAt: new Date() })
      .where(eq(pendingTransactions.checkoutRequestId, checkoutRequestId));
  });
}