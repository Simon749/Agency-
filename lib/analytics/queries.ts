// lib/analytics/queries.ts
// Data aggregation layer for Agency Owner analytics dashboard.
// All queries are scoped to agencyId — zero cross-agency data leaks.
// Uses Drizzle ORM with raw SQL aggregations for performance.

import { eq, and, gte, lte, sql, desc, count, sum } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  tenants,
  buildings,
  units,
  tenantLedger,
  leases,
  agencies,
} from "@/db/schema";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  totalBuildings: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number; // 0-100
  totalTenants: number;
  activeTenants: number;
  totalRentCollectedThisMonth: number;
  totalOutstandingBalance: number;
  totalExpectedRentThisMonth: number;
  collectionRate: number; // 0-100
}

export interface BuildingBreakdown {
  buildingId: string;
  buildingName: string;
  locale: string | null;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  totalRentCollected: number;
  totalOutstanding: number;
  expectedRent: number;
  collectionRate: number;
}

export interface RecentPayment {
  tenantName: string;
  unitNumber: string;
  buildingName: string;
  amount: number;
  method: string;
  referenceCode: string | null;
  date: Date;
}

export interface ArrearsTenant {
  tenantId: string;
  fullName: string;
  phone: string;
  buildingName: string;
  unitNumber: string;
  unitRent: number;
  balance: number;
  daysOverdue: number;
  lastPaymentDate: Date | null;
  lastPaymentAmount: number | null;
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMonthRange(month?: string): { start: string; end: string } {
  const target = month ? new Date(month + "-01") : new Date();
  const year = target.getFullYear();
  const m = target.getMonth();
  const start = new Date(year, m, 1).toISOString().slice(0, 10);
  const end = new Date(year, m + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

// ── 1. Dashboard Summary (top-level KPIs) ──────────────────────────────────

export async function getDashboardSummary(
  agencyId: string,
  month?: string
): Promise<DashboardSummary> {
  const db = getDb();
  const { start, end } = getMonthRange(month);
  const billingMonth = month ?? new Date().toISOString().slice(0, 7);

  // Count buildings, units, tenants
  const [buildingCount] = await db
    .select({ count: count() })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  const [unitCount] = await db
    .select({ count: count() })
    .from(units)
    .where(eq(units.agencyId, agencyId));

  const [occupiedCount] = await db
    .select({ count: count() })
    .from(units)
    .where(and(eq(units.agencyId, agencyId), eq(units.isOccupied, true)));

  const [tenantCount] = await db
    .select({ count: count() })
    .from(tenants)
    .where(eq(tenants.agencyId, agencyId));

  const [activeTenantCount] = await db
    .select({ count: count() })
    .from(tenants)
    .where(
      and(
        eq(tenants.agencyId, agencyId),
        eq(tenants.status, "ACTIVE"),
        eq(tenants.inviteStatus, "ACCEPTED")
      )
    );

  // Rent collected this month (CREDIT entries for RENT category)
  const [collected] = await db
    .select({ total: sum(tenantLedger.amount) })
    .from(tenantLedger)
    .where(
      and(
        eq(tenantLedger.agencyId, agencyId),
        eq(tenantLedger.type, "CREDIT"),
        eq(tenantLedger.category, "RENT"),
        gte(tenantLedger.createdAt, new Date(start)),
        lte(tenantLedger.createdAt, new Date(end + "T23:59:59"))
      )
    );

  // Expected rent this month: sum of rentAmount for all occupied units
  const [expected] = await db
    .select({ total: sum(units.rentAmount) })
    .from(units)
    .where(and(eq(units.agencyId, agencyId), eq(units.isOccupied, true)));

  // Total outstanding balance across all tenants
  // We calculate per-tenant balance in a subquery, then sum positive balances
  const balanceRows = await db
    .select({
      tenantId: tenants.id,
      totalDebit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(tenants)
    .leftJoin(tenantLedger, eq(tenants.id, tenantLedger.tenantId))
    .where(eq(tenants.agencyId, agencyId))
    .groupBy(tenants.id);

  const totalOutstanding = balanceRows.reduce((sum, row) => {
    const balance = Number(row.totalDebit) - Number(row.totalCredit);
    return sum + Math.max(0, balance);
  }, 0);

  const totalBuildings = Number(buildingCount?.count ?? 0);
  const totalUnits = Number(unitCount?.count ?? 0);
  const occupied = Number(occupiedCount?.count ?? 0);
  const totalRentCollected = Number(collected?.total ?? 0);
  const totalExpectedRent = Number(expected?.total ?? 0);

  return {
    totalBuildings,
    totalUnits,
    occupiedUnits: occupied,
    vacantUnits: totalUnits - occupied,
    occupancyRate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
    totalTenants: Number(tenantCount?.count ?? 0),
    activeTenants: Number(activeTenantCount?.count ?? 0),
    totalRentCollectedThisMonth: totalRentCollected,
    totalOutstandingBalance: totalOutstanding,
    totalExpectedRentThisMonth: totalExpectedRent,
    collectionRate: totalExpectedRent > 0
      ? Math.round((totalRentCollected / totalExpectedRent) * 100)
      : 0,
  };
}

// ── 2. Building Breakdown Table ─────────────────────────────────────────────

export async function getBuildingBreakdown(
  agencyId: string,
  month?: string
): Promise<BuildingBreakdown[]> {
  const db = getDb();
  const { start, end } = getMonthRange(month);

  // Get all buildings for this agency
  const buildingRows = await db
    .select({
      id: buildings.id,
      name: buildings.name,
      locale: buildings.locale,
    })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  const results: BuildingBreakdown[] = [];

  for (const b of buildingRows) {
    // Units in this building
    const [unitCount] = await db
      .select({ count: count() })
      .from(units)
      .where(eq(units.buildingId, b.id));

    const [occupiedCount] = await db
      .select({ count: count() })
      .from(units)
      .where(and(eq(units.buildingId, b.id), eq(units.isOccupied, true)));

    // Expected rent
    const [expected] = await db
      .select({ total: sum(units.rentAmount) })
      .from(units)
      .where(and(eq(units.buildingId, b.id), eq(units.isOccupied, true)));

    // Collected rent this month
    const [collected] = await db
      .select({ total: sum(tenantLedger.amount) })
      .from(tenantLedger)
      .where(
        and(
          eq(tenantLedger.agencyId, agencyId),
          eq(tenantLedger.buildingId, b.id),
          eq(tenantLedger.type, "CREDIT"),
          eq(tenantLedger.category, "RENT"),
          gte(tenantLedger.createdAt, new Date(start)),
          lte(tenantLedger.createdAt, new Date(end + "T23:59:59"))
        )
      );

    // Outstanding balance for this building
    const balanceRows = await db
      .select({
        tenantId: tenants.id,
        totalDebit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
        totalCredit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(tenants)
      .leftJoin(tenantLedger, eq(tenants.id, tenantLedger.tenantId))
      .where(and(eq(tenants.agencyId, agencyId), eq(tenants.buildingId, b.id)))
      .groupBy(tenants.id);

    const totalOutstanding = balanceRows.reduce((sum, row) => {
      const balance = Number(row.totalDebit) - Number(row.totalCredit);
      return sum + Math.max(0, balance);
    }, 0);

    const totalUnits = Number(unitCount?.count ?? 0);
    const occupied = Number(occupiedCount?.count ?? 0);
    const expectedRent = Number(expected?.total ?? 0);
    const collectedRent = Number(collected?.total ?? 0);

    results.push({
      buildingId: b.id,
      buildingName: b.name,
      locale: b.locale,
      totalUnits,
      occupiedUnits: occupied,
      occupancyRate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
      totalRentCollected: collectedRent,
      totalOutstanding: totalOutstanding,
      expectedRent: expectedRent,
      collectionRate: expectedRent > 0 ? Math.round((collectedRent / expectedRent) * 100) : 0,
    });
  }

  return results;
}

// ── 3. Recent Payments Feed ──────────────────────────────────────────────────

export async function getRecentPayments(
  agencyId: string,
  limit: number = 10
): Promise<RecentPayment[]> {
  const db = getDb();

  const rows = await db
    .select({
      tenantName: tenants.fullName,
      unitNumber: units.unitNumber,
      buildingName: buildings.name,
      amount: tenantLedger.amount,
      method: tenantLedger.method,
      referenceCode: tenantLedger.referenceCode,
      date: tenantLedger.createdAt,
    })
    .from(tenantLedger)
    .innerJoin(tenants, eq(tenantLedger.tenantId, tenants.id))
    .innerJoin(units, eq(tenants.unitId, units.id))
    .innerJoin(buildings, eq(tenants.buildingId, buildings.id))
    .where(
      and(
        eq(tenantLedger.agencyId, agencyId),
        eq(tenantLedger.type, "CREDIT")
      )
    )
    .orderBy(desc(tenantLedger.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    tenantName: r.tenantName,
    unitNumber: r.unitNumber,
    buildingName: r.buildingName,
    amount: Number(r.amount),
    method: r.method ?? "SYSTEM",
    referenceCode: r.referenceCode,
    date: r.date,
  }));
}

// ── 4. Arrears Report (tenants with balance > 0) ────────────────────────────

export async function getArrearsReport(
  agencyId: string,
  options?: {
    buildingId?: string;
    minBalance?: number;
    sortBy?: "amount" | "days";
    sortOrder?: "asc" | "desc";
  }
): Promise<ArrearsTenant[]> {
  const db = getDb();
  const { buildingId, minBalance = 0, sortBy = "amount", sortOrder = "desc" } = options ?? {};

  // Build tenant + balance + last payment subquery
  const conditions = [eq(tenants.agencyId, agencyId), eq(tenants.status, "ACTIVE")];
  if (buildingId) conditions.push(eq(tenants.buildingId, buildingId));

  const rows = await db
    .select({
      tenantId: tenants.id,
      fullName: tenants.fullName,
      phone: tenants.phone,
      buildingName: buildings.name,
      unitNumber: units.unitNumber,
      unitRent: units.rentAmount,
      totalDebit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      lastPaymentDate: sql<Date | null>`MAX(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.createdAt} END)`,
      lastPaymentAmount: sql<number | null>`MAX(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric END)`,
    })
    .from(tenants)
    .innerJoin(buildings, eq(tenants.buildingId, buildings.id))
    .innerJoin(units, eq(tenants.unitId, units.id))
    .leftJoin(tenantLedger, eq(tenants.id, tenantLedger.tenantId))
    .where(and(...conditions))
    .groupBy(tenants.id, tenants.fullName, tenants.phone, buildings.name, units.unitNumber, units.rentAmount);

  // Filter positive balances and map
  let result: ArrearsTenant[] = rows
    .map((r) => {
      const balance = Number(r.totalDebit) - Number(r.totalCredit);
      // Days overdue: rough estimate based on last payment vs today
      const today = new Date();
      const lastPayment = r.lastPaymentDate ? new Date(r.lastPaymentDate) : null;
      const daysOverdue = lastPayment
        ? Math.max(0, Math.floor((today.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24)) - 30)
        : 30; // If never paid, assume 30 days overdue

      return {
        tenantId: r.tenantId,
        fullName: r.fullName,
        phone: r.phone,
        buildingName: r.buildingName,
        unitNumber: r.unitNumber,
        unitRent: Number(r.unitRent),
        balance,
        daysOverdue,
        lastPaymentDate: r.lastPaymentDate,
        lastPaymentAmount: r.lastPaymentAmount ? Number(r.lastPaymentAmount) : null,
      };
    })
    .filter((t) => t.balance > minBalance);

  // Sort
  result.sort((a, b) => {
    const fieldA = sortBy === "amount" ? a.balance : a.daysOverdue;
    const fieldB = sortBy === "amount" ? b.balance : b.daysOverdue;
    return sortOrder === "asc" ? fieldA - fieldB : fieldB - fieldA;
  });

  return result;
}

// ── 5. Occupancy Trend (optional — for charts) ──────────────────────────────

export async function getOccupancyHistory(
  agencyId: string,
  months: number = 6
): Promise<{ month: string; occupied: number; vacant: number; rate: number }[]> {
  // This is a simplified version. For true historical data you'd need a snapshots table.
  // For now, returns current occupancy repeated (placeholder for V2).
  const db = getDb();
  const [total] = await db.select({ count: count() }).from(units).where(eq(units.agencyId, agencyId));
  const [occupied] = await db
    .select({ count: count() })
    .from(units)
    .where(and(eq(units.agencyId, agencyId), eq(units.isOccupied, true)));

  const totalUnits = Number(total?.count ?? 0);
  const occupiedUnits = Number(occupied?.count ?? 0);
  const rate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const history = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    history.push({
      month: d.toISOString().slice(0, 7),
      occupied: occupiedUnits,
      vacant: totalUnits - occupiedUnits,
      rate,
    });
  }
  return history;
}