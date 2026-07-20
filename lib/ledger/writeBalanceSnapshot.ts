// lib/ledger/writeBalanceSnapshot.ts
//
// Write a balance checkpoint for one tenant, folding in every ledger row
// that exists right now. Call this during the monthly billing cron, after
// that tenant's billing-month DEBITs have been inserted, so each snapshot
// reflects a stable month-end state.

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { balanceSnapshots } from "@/db/schema/balanceSnapshots";

export interface SnapshotWriteResult {
  tenantId: string;
  balance: number;
  cursorCreatedAt: Date;
  cursorEntryId: string;
}

export async function writeBalanceSnapshot(
  tenantId: string,
  asOfMonth: string
): Promise<SnapshotWriteResult | null> {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount::numeric ELSE 0 END), 0) AS total_charged,
      COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount::numeric ELSE 0 END), 0) AS total_paid,
      MAX(created_at) AS cursor_created_at,
      (ARRAY_AGG(id ORDER BY created_at DESC, id DESC))[1] AS cursor_entry_id,
      COUNT(*) AS row_count
    FROM tenant_ledger
    WHERE tenant_id = ${tenantId}
  `);

  const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
  const row = rows[0];

  if (!row || Number(row.row_count) === 0) {
    return null; // nothing to snapshot yet — new tenant, no ledger rows
  }

  const totalCharged = Number(row.total_charged);
  const totalPaid = Number(row.total_paid);
  const balance = totalCharged - totalPaid;
  const cursorCreatedAt = new Date(row.cursor_created_at);
  const cursorEntryId = row.cursor_entry_id as string;

  await db.insert(balanceSnapshots).values({
    tenantId,
    asOfMonth,
    totalCharged: totalCharged.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    balance: balance.toFixed(2),
    cursorCreatedAt,
    cursorEntryId,
  });

  return { tenantId, balance, cursorCreatedAt, cursorEntryId };
}

/**
 * Snapshot a batch of tenants (e.g. all ACTIVE tenants billed this run).
 * One failure doesn't block the rest — failures are returned for the cron
 * summary/logging, same pattern as runMonthlyBilling's existing error handling.
 */
export async function writeSnapshotsForAllTenants(
  tenantIds: string[],
  asOfMonth: string
): Promise<{ succeeded: number; skipped: number; failed: Array<{ tenantId: string; error: string }> }> {
  let succeeded = 0;
  let skipped = 0;
  const failed: Array<{ tenantId: string; error: string }> = [];

  for (const tenantId of tenantIds) {
    try {
      const result = await writeBalanceSnapshot(tenantId, asOfMonth);
      result ? succeeded++ : skipped++;
    } catch (err) {
      failed.push({ tenantId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { succeeded, skipped, failed };
}