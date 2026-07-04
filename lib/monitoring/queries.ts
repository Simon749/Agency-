// lib/monitoring/queries.ts
// PHASE 6: Anomaly detection queries + operational health metrics.
// Used by: admin health dashboard, super admin system monitor, runbook scripts.

import { eq, and, gte, lte, sql, count, desc, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  tenants,
  buildings,
  units,
  tenantLedger,
  pendingTransactions,
  complaints,
  agencies,
} from "@/db/schema";

// ── Types ─────────────────────────────────────────────────────────────────

export interface PaymentAnomaly {
  tenantId: string;
  fullName: string;
  buildingName: string;
  unitNumber: string;
  pendingCount: number;
  totalAmount: number;
  oldestPending: Date;
  risk: "low" | "medium" | "high";
}

export interface WebhookMetrics {
  totalCallbacks24h: number;
  successfulCallbacks24h: number;
  failedCallbacks24h: number;
  duplicateCallbacks24h: number;
  avgProcessingTimeMs: number | null;
}

export interface LedgerDiscrepancy {
  tenantId: string;
  fullName: string;
  buildingName: string;
  unitNumber: string;
  computedBalance: number;
  lastUpdated: Date;
  issue: string;
}

export interface SystemHealthMetrics {
  totalTenants: number;
  activeTenants: number;
  vacatedTenants: number;
  totalBuildings: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  totalLedgerEntries: number;
  ledgerEntriesThisMonth: number;
  pendingTransactionsCount: number;
  failedTransactions24h: number;
  openComplaints: number;
  highPriorityComplaints: number;
  agenciesActive: number;
  agenciesSuspended: number;
}

// ── 1. Payment Anomaly Detection ──────────────────────────────────────────

/**
 * Detect tenants with suspicious pending transaction patterns:
 * - Multiple PENDING STK pushes (possible double-click bug)
 * - Very old pending transactions (stuck callbacks)
 * - High total pending amount vs expected rent
 */
export async function detectPaymentAnomalies(
  agencyId: string,
  options?: {
    minPendingCount?: number;
    maxAgeHours?: number;
  }
): Promise<PaymentAnomaly[]> {
  const db = getDb();
  const { minPendingCount = 2, maxAgeHours = 24 } = options ?? {};

  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const rows = await db
    .select({
      tenantId: pendingTransactions.tenantId,
      fullName: tenants.fullName,
      buildingName: buildings.name,
      unitNumber: units.unitNumber,
      pendingCount: sql<number>`COUNT(*)`,
      totalAmount: sql<number>`COALESCE(SUM(${pendingTransactions.amount}::numeric), 0)`,
      oldestPending: sql<Date>`MIN(${pendingTransactions.initiatedAt})`,
    })
    .from(pendingTransactions)
    .innerJoin(tenants, eq(pendingTransactions.tenantId, tenants.id))
    .innerJoin(buildings, eq(tenants.buildingId, buildings.id))
    .innerJoin(units, eq(tenants.unitId, units.id))
    .where(
      and(
        eq(pendingTransactions.agencyId, agencyId),
        eq(pendingTransactions.status, "PENDING")
      )
    )
    .groupBy(pendingTransactions.tenantId, tenants.fullName, buildings.name, units.unitNumber)
    .having(sql`COUNT(*) >= ${minPendingCount}`);

  return rows.map((r) => {
    const ageHours = (Date.now() - new Date(r.oldestPending).getTime()) / (1000 * 60 * 60);
    const risk: "low" | "medium" | "high" =
      ageHours > 72 || r.pendingCount > 5 ? "high" : ageHours > 24 ? "medium" : "low";

    return {
      tenantId: r.tenantId,
      fullName: r.fullName,
      buildingName: r.buildingName,
      unitNumber: r.unitNumber,
      pendingCount: Number(r.pendingCount),
      totalAmount: Number(r.totalAmount),
      oldestPending: r.oldestPending,
      risk,
    };
  });
}

// ── 2. Ledger Reconciliation — Find Discrepancies ───────────────────────

/**
 * Find tenants whose ledger balance doesn't match the expected state.
 * Checks for: negative balances that shouldn't exist, orphaned entries, etc.
 */
export async function findLedgerDiscrepancies(
  agencyId: string
): Promise<LedgerDiscrepancy[]> {
  const db = getDb();

  const rows = await db
    .select({
      tenantId: tenants.id,
      fullName: tenants.fullName,
      buildingName: buildings.name,
      unitNumber: units.unitNumber,
      totalDebit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      lastEntryDate: sql<Date | null>`MAX(${tenantLedger.createdAt})`,
    })
    .from(tenants)
    .innerJoin(buildings, eq(tenants.buildingId, buildings.id))
    .innerJoin(units, eq(tenants.unitId, units.id))
    .leftJoin(tenantLedger, eq(tenants.id, tenantLedger.tenantId))
    .where(eq(tenants.agencyId, agencyId))
    .groupBy(tenants.id, tenants.fullName, buildings.name, units.unitNumber);

  const discrepancies: LedgerDiscrepancy[] = [];

  for (const r of rows) {
    const balance = Number(r.totalDebit) - Number(r.totalCredit);
    const lastEntry = r.lastEntryDate ? new Date(r.lastEntryDate) : null;
    const daysSinceEntry = lastEntry
      ? Math.floor((Date.now() - lastEntry.getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    // Flag: Active tenant with no ledger entries in 90 days
    if (daysSinceEntry > 90 && balance === 0) {
      discrepancies.push({
        tenantId: r.tenantId,
        fullName: r.fullName,
        buildingName: r.buildingName,
        unitNumber: r.unitNumber,
        computedBalance: balance,
        lastUpdated: lastEntry ?? new Date(0),
        issue: "Active tenant with no ledger activity in 90+ days",
      });
    }

    // Flag: Negative balance (overpaid) — not necessarily wrong, but worth review
    if (balance < -1000) {
      discrepancies.push({
        tenantId: r.tenantId,
        fullName: r.fullName,
        buildingName: r.buildingName,
        unitNumber: r.unitNumber,
        computedBalance: balance,
        lastUpdated: lastEntry ?? new Date(0),
        issue: `Overpaid by KES ${Math.abs(balance).toLocaleString("en-KE")}`,
      });
    }
  }

  return discrepancies;
}

// ── 3. System-wide Health Metrics ────────────────────────────────────────

export async function getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
  const db = getDb();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    tenantCounts,
    buildingCount,
    unitCounts,
    ledgerTotal,
    ledgerThisMonth,
    pendingCount,
    failed24h,
    complaintCounts,
    agencyCounts,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        active: sql<number>`COUNT(CASE WHEN ${tenants.status} = 'ACTIVE' THEN 1 END)`,
        vacated: sql<number>`COUNT(CASE WHEN ${tenants.status} = 'VACATED' THEN 1 END)`,
      })
      .from(tenants),
    db.select({ count: count() }).from(buildings),
    db
      .select({
        total: count(),
        occupied: sql<number>`COUNT(CASE WHEN ${units.isOccupied} = true THEN 1 END)`,
      })
      .from(units),
    db.select({ count: count() }).from(tenantLedger),
    db
      .select({ count: count() })
      .from(tenantLedger)
      .where(gte(tenantLedger.createdAt, monthStart)),
    db
      .select({ count: count() })
      .from(pendingTransactions)
      .where(eq(pendingTransactions.status, "PENDING")),
    db
      .select({ count: count() })
      .from(pendingTransactions)
      .where(
        and(
          eq(pendingTransactions.status, "FAILED"),
          gte(pendingTransactions.initiatedAt, yesterday)
        )
      ),
    db
      .select({
        open: sql<number>`COUNT(CASE WHEN ${complaints.status} = 'OPEN' THEN 1 END)`,
        high: sql<number>`COUNT(CASE WHEN ${complaints.status} = 'OPEN' AND ${complaints.priority} = 'HIGH' THEN 1 END)`,
      })
      .from(complaints),
    db
      .select({
        active: sql<number>`COUNT(CASE WHEN ${agencies.isActive} = true THEN 1 END)`,
        suspended: sql<number>`COUNT(CASE WHEN ${agencies.isActive} = false THEN 1 END)`,
      })
      .from(agencies),
  ]);

  const totalUnits = Number(unitCounts[0]?.total ?? 0);
  const occupied = Number(unitCounts[0]?.occupied ?? 0);

  return {
    totalTenants: Number(tenantCounts[0]?.total ?? 0),
    activeTenants: Number(tenantCounts[0]?.active ?? 0),
    vacatedTenants: Number(tenantCounts[0]?.vacated ?? 0),
    totalBuildings: Number(buildingCount[0]?.count ?? 0),
    totalUnits,
    occupiedUnits: occupied,
    occupancyRate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
    totalLedgerEntries: Number(ledgerTotal[0]?.count ?? 0),
    ledgerEntriesThisMonth: Number(ledgerThisMonth[0]?.count ?? 0),
    pendingTransactionsCount: Number(pendingCount[0]?.count ?? 0),
    failedTransactions24h: Number(failed24h[0]?.count ?? 0),
    openComplaints: Number(complaintCounts[0]?.open ?? 0),
    highPriorityComplaints: Number(complaintCounts[0]?.high ?? 0),
    agenciesActive: Number(agencyCounts[0]?.active ?? 0),
    agenciesSuspended: Number(agencyCounts[0]?.suspended ?? 0),
  };
}

// ── 4. Failed Payment Analysis ────────────────────────────────────────────

export interface FailedPaymentAnalysis {
  totalFailed24h: number;
  totalFailed7d: number;
  topFailureReasons: { reason: string; count: number }[];
  affectedTenants: number;
  totalFailedAmount: number;
}

export async function analyzeFailedPayments(agencyId?: string): Promise<FailedPaymentAnalysis> {
  const db = getDb();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const conditions = agencyId ? [eq(pendingTransactions.agencyId, agencyId)] : [];

  const [failed24h, failed7d, reasons] = await Promise.all([
    db
      .select({ count: count(), amount: sql<number>`COALESCE(SUM(${pendingTransactions.amount}::numeric), 0)` })
      .from(pendingTransactions)
      .where(and(eq(pendingTransactions.status, "FAILED"), gte(pendingTransactions.initiatedAt, dayAgo), ...conditions)),
    db
      .select({ count: count() })
      .from(pendingTransactions)
      .where(and(eq(pendingTransactions.status, "FAILED"), gte(pendingTransactions.initiatedAt, weekAgo), ...conditions)),
    db
      .select({
        reason: pendingTransactions.failureReason,
        count: sql<number>`COUNT(*)`,
      })
      .from(pendingTransactions)
      .where(and(eq(pendingTransactions.status, "FAILED"), gte(pendingTransactions.initiatedAt, weekAgo), ...conditions))
      .groupBy(pendingTransactions.failureReason)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5),
  ]);

  return {
    totalFailed24h: Number(failed24h[0]?.count ?? 0),
    totalFailed7d: Number(failed7d[0]?.count ?? 0),
    topFailureReasons: reasons.map((r) => ({
      reason: r.reason ?? "Unknown",
      count: Number(r.count),
    })),
    affectedTenants: Number(failed7d[0]?.count ?? 0), // approximate
    totalFailedAmount: Number(failed24h[0]?.amount ?? 0),
  };
}
