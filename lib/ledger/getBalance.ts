// lib/ledger/getBalance.ts
// PHASE C: reads the latest balance_snapshot + only the ledger rows written
// since that snapshot's cursor, instead of summing full history every call.
// Falls back to full-history aggregation when no snapshot exists yet (new
// tenants, or before the first billing cron run creates one) — behaviour
// is identical to before in that case.

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger } from "@/db/schema";
import { balanceSnapshots } from "@/db/schema/balanceSnapshots";
export interface BalanceResult {
  totalCharged: number;
  totalPaid: number;
  balance: number; // positive = owes money, negative = overpaid
}

async function getLatestSnapshot(tenantId: string) {
  const db = getDb();
  const [snapshot] = await db
    .select()
    .from(balanceSnapshots)
    .where(eq(balanceSnapshots.tenantId, tenantId))
    .orderBy(sql`${balanceSnapshots.cursorCreatedAt} DESC`)
    .limit(1);
  return snapshot ?? null;
}

async function getFullHistoryBalance(tenantId: string): Promise<BalanceResult> {
  const db = getDb();
  const [result] = await db
    .select({
      totalCharged: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(tenantLedger)
    .where(eq(tenantLedger.tenantId, tenantId));

  const totalCharged = Number(result?.totalCharged ?? 0);
  const totalPaid = Number(result?.totalPaid ?? 0);
  return { totalCharged, totalPaid, balance: totalCharged - totalPaid };
}

export async function getTenantBalance(tenantId: string): Promise<BalanceResult> {
  const db = getDb();
  const snapshot = await getLatestSnapshot(tenantId);

  if (!snapshot) {
    return getFullHistoryBalance(tenantId);
  }

  // Strict tuple comparison — same (created_at, id) tie-break used by
  // getStatement.ts — so no row at the boundary is double-counted or skipped.
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount::numeric ELSE 0 END), 0) AS delta_charged,
      COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount::numeric ELSE 0 END), 0) AS delta_paid
    FROM tenant_ledger
    WHERE tenant_id = ${tenantId}
      AND (created_at, id) > (${snapshot.cursorCreatedAt}, ${snapshot.cursorEntryId})
  `);

  const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
  const row = rows[0] ?? { delta_charged: 0, delta_paid: 0 };

  const totalCharged = Number(snapshot.totalCharged) + Number(row.delta_charged);
  const totalPaid = Number(snapshot.totalPaid) + Number(row.delta_paid);

  return { totalCharged, totalPaid, balance: totalCharged - totalPaid };
}

/**
 * Unchanged — per-month balance doesn't benefit from snapshotting since
 * billing_month already narrows the scan to an index-friendly slice.
 */
export async function getTenantBalanceForMonth(
  tenantId: string,
  billingMonth: string
): Promise<BalanceResult> {
  const db = getDb();
  const [result] = await db
    .select({
      totalCharged: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(tenantLedger)
    .where(sql`${tenantLedger.tenantId} = ${tenantId} AND ${tenantLedger.billingMonth} = ${billingMonth}`);

  const totalCharged = Number(result?.totalCharged ?? 0);
  const totalPaid = Number(result?.totalPaid ?? 0);
  return { totalCharged, totalPaid, balance: totalCharged - totalPaid };
}

/**
 * Verification helper — confirms snapshot-based balance matches full-history
 * balance exactly. Used by the backfill script; should return true for every
 * tenant before this is trusted in production (Phase C exit criteria).
 */
export async function verifyBalanceMatchesFullHistory(tenantId: string): Promise<{
  matches: boolean;
  snapshotBalance: number;
  fullHistoryBalance: number;
}> {
  const [snapshotBased, fullHistory] = await Promise.all([
    getTenantBalance(tenantId),
    getFullHistoryBalance(tenantId),
  ]);

  return {
    matches: Math.abs(snapshotBased.balance - fullHistory.balance) < 0.01,
    snapshotBalance: snapshotBased.balance,
    fullHistoryBalance: fullHistory.balance,
  };
}