// lib/ledger/allocatePayment.ts
//
// Allocates a CREDIT (payment) against open DEBIT (charge) rows for a tenant,
// in priority order: oldest arrears first, then current-month rent, then
// current-month utilities. Call this AFTER a credit row has been committed
// to tenant_ledger — see the three call sites noted in the accompanying patch
// notes (STK webhook, C2B confirm, manual cash receipt action).

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger } from "@/db/schema";
import { ledgerAllocations } from "@/db/schema/ledgerAllocations";

// Decide and document the allocation order explicitly (per Phase C):
// arrears first, then rent, then utilities — same-priority rows are then
// ordered oldest-first.
const CATEGORY_PRIORITY: Record<string, number> = {
  PREVIOUS_BALANCE: 0,
  RENT: 1,
  WATER: 2,
  ELECTRICITY: 2,
  GARBAGE: 2,
  WIFI: 2,
  SERVICE_CHARGE: 2,
  SECURITY: 2,
};

function priorityOf(category: string): number {
  return CATEGORY_PRIORITY[category] ?? 99; // unknown categories go last, not first
}

export interface AllocationResult {
  creditEntryId: string;
  totalAllocated: number;
  unallocatedRemainder: number; // e.g. tenant overpaid — no open debit to apply it to
  allocations: Array<{ debitEntryId: string; amountApplied: number }>;
}

/**
 * Idempotent: if this credit has already been allocated (in whole or part),
 * calling again only allocates the remainder — safe to call on webhook
 * retries or if a previous call partially failed.
 */
export async function allocatePayment(
  tenantId: string,
  creditEntryId: string
): Promise<AllocationResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    // Lock the credit row so two concurrent calls for the same credit
    // (e.g. a retried webhook racing a manual re-trigger) can't double-allocate.
    const creditResult = await tx.execute(sql`
      SELECT id, amount, type
      FROM tenant_ledger
      WHERE id = ${creditEntryId} AND tenant_id = ${tenantId}
      FOR UPDATE
    `);
    const creditRows = Array.isArray(creditResult) ? creditResult : (creditResult as any).rows ?? [];
    const creditRow = creditRows[0];

    if (!creditRow) {
      throw new Error(`Ledger entry ${creditEntryId} not found for tenant ${tenantId}`);
    }
    if (creditRow.type !== "CREDIT") {
      throw new Error(`Ledger entry ${creditEntryId} is not a CREDIT — cannot allocate`);
    }

    const existing = await tx
      .select({
        total: sql<number>`COALESCE(SUM(${ledgerAllocations.amountApplied}::numeric), 0)`,
      })
      .from(ledgerAllocations)
      .where(eq(ledgerAllocations.creditEntryId, creditEntryId));

    const alreadyAllocated = Number(existing[0]?.total ?? 0);
    const creditAmount = Number(creditRow.amount);
    let remaining = creditAmount - alreadyAllocated;

    if (remaining <= 0) {
      return {
        creditEntryId,
        totalAllocated: alreadyAllocated,
        unallocatedRemainder: 0,
        allocations: [],
      };
    }

    // Open DEBIT rows (amount minus whatever's already been applied to them),
    // in priority + age order. The HAVING clause excludes fully-paid debits.
    const debitResult = await tx.execute(sql`
      SELECT
        d.id,
        d.category,
        d.amount::numeric AS amount,
        d.created_at,
        COALESCE(SUM(a.amount_applied::numeric), 0) AS applied
      FROM tenant_ledger d
      LEFT JOIN ledger_allocations a ON a.debit_entry_id = d.id
      WHERE d.tenant_id = ${tenantId} AND d.type = 'DEBIT'
      GROUP BY d.id, d.category, d.amount, d.created_at
      HAVING d.amount::numeric - COALESCE(SUM(a.amount_applied::numeric), 0) > 0
      ORDER BY d.created_at ASC, d.id ASC
    `);
    const rawDebits = Array.isArray(debitResult) ? debitResult : (debitResult as any).rows ?? [];

    const openDebits = rawDebits
      .map((r: any) => ({
        id: r.id as string,
        category: r.category as string,
        outstanding: Number(r.amount) - Number(r.applied),
        createdAt: new Date(r.created_at),
      }))
      .sort((a: any, b: any) => {
        const p = priorityOf(a.category) - priorityOf(b.category);
        return p !== 0 ? p : a.createdAt.getTime() - b.createdAt.getTime();
      });

    const allocations: Array<{ debitEntryId: string; amountApplied: number }> = [];

    for (const debit of openDebits) {
      if (remaining <= 0) break;
      const applyAmount = Math.min(remaining, debit.outstanding);
      if (applyAmount <= 0) continue;

      await tx.insert(ledgerAllocations).values({
        creditEntryId,
        debitEntryId: debit.id,
        amountApplied: applyAmount.toFixed(2),
      });

      allocations.push({ debitEntryId: debit.id, amountApplied: applyAmount });
      remaining -= applyAmount;
    }

    return {
      creditEntryId,
      totalAllocated: creditAmount - remaining,
      unallocatedRemainder: Math.max(0, remaining),
      allocations,
    };
  });
}

/**
 * For a statement view: "this payment cleared these specific charges."
 */
export async function getAllocationsForCredit(creditEntryId: string) {
  const db = getDb();
  return db
    .select()
    .from(ledgerAllocations)
    .where(eq(ledgerAllocations.creditEntryId, creditEntryId));
}

/**
 * For a charge's detail view: "this debit was cleared by these payments."
 */
export async function getAllocationsForDebit(debitEntryId: string) {
  const db = getDb();
  return db
    .select()
    .from(ledgerAllocations)
    .where(eq(ledgerAllocations.debitEntryId, debitEntryId));
}