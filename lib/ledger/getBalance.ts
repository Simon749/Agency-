// lib/ledger/getBalance.ts
// Calculate tenant balance — PHASE 2 OPTIMIZED
// Uses SQL aggregation with index-only scan (O(1) not O(n))

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger } from "@/db/schema";

export interface BalanceResult {
  totalCharged: number;
  totalPaid: number;
  balance: number; // positive = owes money, negative = overpaid
}

/**
 * Calculate tenant balance using SQL aggregation.
 * With idx_tenant_ledger_tenant_type, PostgreSQL computes this
 * via an index-only scan — no table rows touched.
 * 
 * BEFORE: Loaded ALL rows into memory, JS reduce loop (O(n))
 * AFTER:  Single SQL aggregate query (O(1))
 */
export async function getTenantBalance(tenantId: string): Promise<BalanceResult> {
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

  return {
    totalCharged,
    totalPaid,
    balance: totalCharged - totalPaid,
  };
}

/**
 * Get balance for a specific billing month only.
 * Useful for "June 2026 statement" views.
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
    .where(
      and(
        eq(tenantLedger.tenantId, tenantId),
        eq(tenantLedger.billingMonth, billingMonth)
      )
    );

  const totalCharged = Number(result?.totalCharged ?? 0);
  const totalPaid = Number(result?.totalPaid ?? 0);

  return {
    totalCharged,
    totalPaid,
    balance: totalCharged - totalPaid,
  };
}

import { and } from "drizzle-orm";