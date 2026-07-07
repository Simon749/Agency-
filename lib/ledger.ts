// lib/ledger.ts
// PHASE 3 FIX: Transaction-wrapped inserts with proper idempotency
// PHASE 4 FIX: agencyId filtering on EVERY query (Design.md §4.1)

import { sql, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger, pendingTransactions, tenants, buildings } from "@/db/schema";
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

/**
 * ── Balance Calculation ────────────────────────────────────────────────────
 * Design.md §6: "Never store a current_balance column. Always calculate on read."
 * 
 * CRITICAL FIX: agencyId is now REQUIRED. Every query filters by agencyId.
 * This prevents a malicious tenantId from leaking data across agencies.
 */
export async function getTenantBalance(
  tenantId: string,
  agencyId: string,
  billingMonth?: string
): Promise<BalanceResult> {
  if (!agencyId) {
    throw new Error("[LEDGER] agencyId is required for all balance queries");
  }

  const db = getDb();

  // Build conditions: always filter by tenantId + agencyId
  const conditions = [
    eq(tenantLedger.tenantId, tenantId),
    eq(tenantLedger.agencyId, agencyId),
  ];

  // Optional billingMonth filter (matches Design.md signature)
  if (billingMonth) {
    conditions.push(eq(tenantLedger.billingMonth, billingMonth));
  }

  const [result] = await db
    .select({
      totalCharged: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount} ELSE 0 END), 0)`,
      totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount} ELSE 0 END), 0)`,
    })
    .from(tenantLedger)
    .where(and(...conditions));

  const totalCharged = Number(result.totalCharged);
  const totalPaid = Number(result.totalPaid);
  return { totalCharged, totalPaid, balance: totalCharged - totalPaid };
}

/**
 * ── Insert Payment Credit (M-Pesa callback or manual entry) ──────────────
 * 
 * CRITICAL FIXES:
 * 1. agencyId is REQUIRED and validated against the tenant's agency
 * 2. recordedBy is REQUIRED for audit trail (Design.md §4.2)
 * 3. category is validated, not hardcoded to RENT
 * 4. Double-guard: pendingTransactions FOR UPDATE + tenantLedger unique check
 */
export async function insertPaymentCredit(
  entry: Omit<InsertTenantLedgerEntry, "id" | "createdAt" | "type">,
  recordedBy: string // Clerk user ID — REQUIRED for audit trail
): Promise<{ success: boolean; ledgerId?: string; alreadyExists?: boolean }> {
  const db = getDb();

  // ── Validation ────────────────────────────────────────────────────────
  if (!entry.agencyId) {
    throw new Error("[LEDGER] agencyId is required for all ledger inserts");
  }
  if (!recordedBy) {
    throw new Error("[LEDGER] recordedBy (clerkUserId) is required for audit trail");
  }
  if (!entry.referenceCode) {
    throw new Error("[LEDGER] referenceCode is required for all payments");
  }
  if (!entry.category) {
    throw new Error("[LEDGER] category is required — cannot default to RENT");
  }

  // Validate category is a valid enum value
  const validCategories = [
    "RENT", "WATER", "ELECTRICITY", "GARBAGE", "SERVICE_CHARGE",
    "WIFI", "SECURITY", "PREVIOUS_BALANCE", "DEPOSIT",
  ];
  if (!validCategories.includes(entry.category)) {
    throw new Error(`[LEDGER] Invalid category: ${entry.category}`);
  }

  try {
    const result = await db.transaction(async (tx) => {
      // ── Step 1: Verify tenant belongs to this agency ─────────────────
      const [tenant] = await tx
        .select({ id: tenants.id, agencyId: tenants.agencyId })
        .from(tenants)
        .where(eq(tenants.id, entry.tenantId))
        .limit(1);

      if (!tenant) {
        throw new Error(`[LEDGER] Tenant ${entry.tenantId} not found`);
      }
      if (tenant.agencyId !== entry.agencyId) {
        throw new Error(
          `[LEDGER] Agency mismatch: tenant belongs to ${tenant.agencyId}, ` +
          `but insert requested for ${entry.agencyId}`
        );
      }

      // ── Step 2: Check pendingTransactions (FOR UPDATE) ───────────────
      const referenceCode = entry.referenceCode!;
      const [pendingTx] = await tx
        .select({ id: pendingTransactions.id, status: pendingTransactions.status })
        .from(pendingTransactions)
        .where(
          and(
            eq(pendingTransactions.checkoutRequestId, referenceCode),
            eq(pendingTransactions.agencyId, entry.agencyId) // agency-scoped
          )
        )
        .for("update")
        .limit(1);

      if (pendingTx?.status === "COMPLETED") {
        const [existingLedger] = await tx
          .select({ id: tenantLedger.id })
          .from(tenantLedger)
          .where(
            and(
              eq(tenantLedger.referenceCode, referenceCode),
              eq(tenantLedger.agencyId, entry.agencyId)
            )
          )
          .limit(1);
        return { success: true, alreadyExists: true, ledgerId: existingLedger?.id };
      }

      // ── Step 3: Check tenantLedger for existing referenceCode ────────
      const [existing] = await tx
        .select({ id: tenantLedger.id })
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.referenceCode, referenceCode),
            eq(tenantLedger.agencyId, entry.agencyId)
          )
        )
        .limit(1);

      if (existing) {
        return { success: true, alreadyExists: true, ledgerId: existing.id };
      }

      // ── Step 4: INSERT the CREDIT row ──────────────────────────────
      const [inserted] = await tx
        .insert(tenantLedger)
        .values({
          ...entry,
          type: "CREDIT",
          recordedBy, // ← audit trail: who processed this payment
        } as InsertTenantLedgerEntry)
        .returning({ id: tenantLedger.id });

      return { success: true, ledgerId: inserted.id };
    });

    return result;
  } catch (err: any) {
    // ── Fallback: handle race-condition unique constraint violation ──
    if ((err.code === "23505" || err.message?.includes("unique constraint")) && entry.referenceCode) {
      const [existing] = await db
        .select({ id: tenantLedger.id })
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.referenceCode, entry.referenceCode),
            eq(tenantLedger.agencyId, entry.agencyId)
          )
        )
        .limit(1);
      return { success: true, alreadyExists: true, ledgerId: existing?.id };
    }
    console.error("[LEDGER] Insert failed:", err);
    throw err;
  }
}

/**
 * ── Batch Insert (Monthly Billing Cron) ──────────────────────────────────
 * 
 * CRITICAL FIX: agencyId is REQUIRED and validated for every entry.
 * All entries must belong to the same agency (caller responsibility).
 */
export async function insertLedgerBatch(
  agencyId: string,
  entries: Array<Omit<InsertTenantLedgerEntry, "id" | "createdAt">>
): Promise<{ inserted: number; skipped: number }> {
  if (!agencyId) {
    throw new Error("[LEDGER] agencyId is required for batch inserts");
  }
  if (entries.length === 0) return { inserted: 0, skipped: 0 };

  // Validate all entries belong to the requested agency
  const mismatched = entries.filter((e) => e.agencyId !== agencyId);
  if (mismatched.length > 0) {
    throw new Error(
      `[LEDGER] Batch insert agency mismatch: ${mismatched.length} entries ` +
      `do not belong to agency ${agencyId}`
    );
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    // ── Step 1: Collect reference codes ────────────────────────────────
    const refCodes = entries
      .map((e) => e.referenceCode)
      .filter((r): r is string => Boolean(r));

    let existingIds = new Set<string>();

    // ── Step 2: Check existing entries (agency-scoped) ───────────────
    if (refCodes.length > 0) {
      const existing = await tx
        .select({ ref: tenantLedger.referenceCode })
        .from(tenantLedger)
        .where(
          and(
            sql`${tenantLedger.referenceCode} IN (${sql.join(
              refCodes.map((code) => sql`${code}`),
              sql`, `
            )})`,
            eq(tenantLedger.agencyId, agencyId) // ← agency-scoped
          )
        );
      existingIds = new Set(existing.map((e) => e.ref).filter((r): r is string => r != null));
    }

    // ── Step 3: Filter out duplicates ────────────────────────────────
    const toInsert = entries.filter((e) => !existingIds.has(e.referenceCode ?? ""));

    // ── Step 4: Batch insert ─────────────────────────────────────────
    if (toInsert.length > 0) {
      await tx.insert(tenantLedger).values(toInsert as InsertTenantLedgerEntry[]);
    }

    return { inserted: toInsert.length, skipped: entries.length - toInsert.length };
  });
}

/**
 * ── Pending Transaction Lookup ───────────────────────────────────────────
 * 
 * FIX: agencyId is REQUIRED to prevent cross-agency lookup.
 */
export async function getPendingTransaction(
  checkoutRequestId: string,
  agencyId: string
) {
  if (!agencyId) {
    throw new Error("[LEDGER] agencyId is required for pending transaction lookup");
  }

  const db = getDb();
  const [tx] = await db
    .select()
    .from(pendingTransactions)
    .where(
      and(
        eq(pendingTransactions.checkoutRequestId, checkoutRequestId),
        eq(pendingTransactions.agencyId, agencyId)
      )
    )
    .limit(1);
  return tx ?? null;
}

/**
 * ── Update Pending Transaction (Webhook Callback) ──────────────────────
 * 
 * CRITICAL FIX: agencyId is REQUIRED and validated.
 * The checkoutRequestId must belong to the specified agency.
 */
export async function updatePendingTransaction(
  checkoutRequestId: string,
  agencyId: string,
  updates: {
    status: "COMPLETED" | "FAILED" | "REJECTED";
    resultCode?: string;
    resultDesc?: string;
    mpesaReceiptNumber?: string;
  }
): Promise<void> {
  if (!agencyId) {
    throw new Error("[LEDGER] agencyId is required for pending transaction updates");
  }

  const db = getDb();

  await db.transaction(async (tx) => {
    // ── Step 1: Lock and verify agency ownership ───────────────────
    const [pendingTx] = await tx
      .select({ id: pendingTransactions.id, agencyId: pendingTransactions.agencyId })
      .from(pendingTransactions)
      .where(
        and(
          eq(pendingTransactions.checkoutRequestId, checkoutRequestId),
          eq(pendingTransactions.agencyId, agencyId)
        )
      )
      .for("update")
      .limit(1);

    if (!pendingTx) {
      throw new Error(
        `[LEDGER] Pending transaction ${checkoutRequestId} not found ` +
        `for agency ${agencyId}`
      );
    }

    // ── Step 2: Update with completedAt timestamp ──────────────────
    await tx
      .update(pendingTransactions)
      .set({
        status: updates.status,
        resultCode: updates.resultCode ?? null,
        resultDesc: updates.resultDesc ?? null,
        mpesaCode: updates.mpesaReceiptNumber ?? null,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(pendingTransactions.checkoutRequestId, checkoutRequestId),
          eq(pendingTransactions.agencyId, agencyId)
        )
      );
  });
}

/**
 * ── Helper: Validate tenant belongs to agency ────────────────────────────
 * Use this in server actions before calling ledger functions.
 */
export async function validateTenantAgency(
  tenantId: string,
  agencyId: string
): Promise<boolean> {
  const db = getDb();
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(
      and(
        eq(tenants.id, tenantId),
        eq(tenants.agencyId, agencyId)
      )
    )
    .limit(1);
  return Boolean(tenant);
}

/**
 * ── Helper: Get building shortcode for Daraja validation ─────────────────
 * Used by webhook handlers to verify BillRefNumber against building.
 */
export async function getBuildingByShortcode(
  shortcode: string,
  agencyId: string
) {
  const db = getDb();
  const [building] = await db
    .select({
      id: buildings.id,
      agencyId: buildings.agencyId,
      darajaShortcode: buildings.darajaShortcode,
    })
    .from(buildings)
    .where(
      and(
        eq(buildings.darajaShortcode, shortcode),
        eq(buildings.agencyId, agencyId)
      )
    )
    .limit(1);
  return building ?? null;
}