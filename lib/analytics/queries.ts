// lib/analytics/queries.ts
// Data aggregation layer for Agency Owner analytics dashboard.
// PHASE 2 OPTIMIZED: All N+1 loops eliminated. Single-query aggregations.
// All queries scoped to agencyId — zero cross-agency data leaks.

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
import { unstable_cache } from "next/cache";
import { ReactNode } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  totalBuildings: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  totalTenants: number;
  activeTenants: number;
  totalRentCollectedThisMonth: number;
  totalOutstandingBalance: number;
  totalExpectedRentThisMonth: number;
  collectionRate: number;
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

export type ArrearsTenant = {
  tenantId: string;
  tenantName: string;
  fullName: string;
  phone: string;
  buildingName: string;
  unitNumber: string;
  unitRent: number;
  balance: number;
  daysOverdue: number;
  lastPaymentDate: Date | null;
  lastPaymentAmount: number | null;
};

export interface DateRange {
  from: string;
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

// ── 1. Dashboard Summary — CACHED 30s ──────────────────────────────────────

/**
 * Get dashboard summary with 30-second Next.js cache.
 * Cache invalidated automatically on mutations via revalidateTag('dashboard').
 * 
 * BEFORE: 8 sequential queries + per-tenant balance loop
 * AFTER:  8 parallel queries + single SQL aggregate for outstanding
 */
export const getDashboardSummary = unstable_cache(
  async (agencyId: string, month?: string): Promise<DashboardSummary> => {
    const db = getDb();
    const { start, end } = getMonthRange(month);

    // All counts in parallel — each is a simple indexed lookup
    const [
      buildingCount,
      unitCount,
      occupiedCount,
      tenantCount,
      activeTenantCount,
      collected,
      expected,
      outstanding,
    ] = await Promise.all([
      db.select({ count: count() }).from(buildings).where(eq(buildings.agencyId, agencyId)),
      db.select({ count: count() }).from(units).where(eq(units.agencyId, agencyId)),
      db.select({ count: count() }).from(units).where(and(eq(units.agencyId, agencyId), eq(units.isOccupied, true))),
      db.select({ count: count() }).from(tenants).where(eq(tenants.agencyId, agencyId)),
      db.select({ count: count() }).from(tenants).where(
        and(eq(tenants.agencyId, agencyId), eq(tenants.status, "ACTIVE"), eq(tenants.inviteStatus, "ACCEPTED"))
      ),
      db.select({ total: sum(tenantLedger.amount) }).from(tenantLedger).where(
        and(
          eq(tenantLedger.agencyId, agencyId),
          eq(tenantLedger.type, "CREDIT"),
          eq(tenantLedger.category, "RENT"),
          gte(tenantLedger.createdAt, new Date(start)),
          lte(tenantLedger.createdAt, new Date(end + "T23:59:59"))
        )
      ),
      db.select({ total: sum(units.rentAmount) }).from(units).where(and(eq(units.agencyId, agencyId), eq(units.isOccupied, true))),
      // Total outstanding — SINGLE QUERY for all tenants
      db.select({
        outstanding: sql<number>`COALESCE(SUM(
          CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END -
          CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END
        ), 0)`,
      }).from(tenants).leftJoin(tenantLedger, eq(tenants.id, tenantLedger.tenantId)).where(eq(tenants.agencyId, agencyId)),
    ]);

    const totalBuildings = Number(buildingCount[0]?.count ?? 0);
    const totalUnits = Number(unitCount[0]?.count ?? 0);
    const occupied = Number(occupiedCount[0]?.count ?? 0);
    const totalRentCollected = Number(collected[0]?.total ?? 0);
    const totalExpectedRent = Number(expected[0]?.total ?? 0);
    const totalOutstanding = Math.max(0, Number(outstanding[0]?.outstanding ?? 0));

    return {
      totalBuildings,
      totalUnits,
      occupiedUnits: occupied,
      vacantUnits: totalUnits - occupied,
      occupancyRate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
      totalTenants: Number(tenantCount[0]?.count ?? 0),
      activeTenants: Number(activeTenantCount[0]?.count ?? 0),
      totalRentCollectedThisMonth: totalRentCollected,
      totalOutstandingBalance: totalOutstanding,
      totalExpectedRentThisMonth: totalExpectedRent,
      collectionRate: totalExpectedRent > 0
        ? Math.round((totalRentCollected / totalExpectedRent) * 100)
        : 0,
    };
  },
  ['dashboard-summary'],
  { revalidate: 30, tags: ['dashboard'] }
);

// ── 2. Building Breakdown — SINGLE QUERY (no N+1 loop) ────────────────────

/**
 * PHASE 2 FIX: Replaced per-building loop (N+1 queries) with single
 * aggregation query using GROUP BY. From ~10 queries per building → 1 query total.
 * 
 * Uses idx_buildings_agency_id, idx_units_building_id, idx_tenant_ledger_building_id.
 */
export async function getBuildingBreakdown(
  agencyId: string,
  month?: string
): Promise<BuildingBreakdown[]> {
  const db = getDb();
  const { start, end } = getMonthRange(month);

  const rows = await db
    .select({
      buildingId: buildings.id,
      buildingName: buildings.name,
      locale: buildings.locale,
      totalUnits: sql<number>`COALESCE(COUNT(DISTINCT ${units.id}), 0)`,
      occupiedUnits: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${units.isOccupied} = true THEN ${units.id} END), 0)`,
      expectedRent: sql<number>`COALESCE(SUM(CASE WHEN ${units.isOccupied} = true THEN ${units.rentAmount}::numeric ELSE 0 END), 0)`,
      totalRentCollected: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' AND ${tenantLedger.category} = 'RENT' AND ${tenantLedger.createdAt} >= ${new Date(start)} AND ${tenantLedger.createdAt} <= ${new Date(end + "T23:59:59")} THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      totalOutstanding: sql<number>`GREATEST(0, COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0))`,
    })
    .from(buildings)
    .leftJoin(units, eq(buildings.id, units.buildingId))
    .leftJoin(tenants, eq(buildings.id, tenants.buildingId))
    .leftJoin(tenantLedger, eq(tenants.id, tenantLedger.tenantId))
    .where(eq(buildings.agencyId, agencyId))
    .groupBy(buildings.id, buildings.name, buildings.locale)
    .orderBy(buildings.name);

  return rows.map((r) => {
    const totalUnits = Number(r.totalUnits);
    const occupied = Number(r.occupiedUnits);
    const expectedRent = Number(r.expectedRent);
    const collected = Number(r.totalRentCollected);
    const outstanding = Number(r.totalOutstanding);

    return {
      buildingId: r.buildingId,
      buildingName: r.buildingName,
      locale: r.locale,
      totalUnits,
      occupiedUnits: occupied,
      occupancyRate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
      totalRentCollected: collected,
      totalOutstanding: outstanding,
      expectedRent,
      collectionRate: expectedRent > 0 ? Math.round((collected / expectedRent) * 100) : 0,
    };
  });
}

// ── 3. Recent Payments Feed — already efficient, minor tweak ──────────────

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

// ── 4. Arrears Report — SQL HAVING filter (not JS filter) ────────────────

/**
 * PHASE 2 FIX: Replaced JS filtering with SQL HAVING clause.
 * PostgreSQL filters before returning rows — less data over the wire.
 * Uses idx_tenants_agency_id + idx_tenant_ledger_tenant_id.
 */
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
    .groupBy(tenants.id, tenants.fullName, tenants.phone, buildings.name, units.unitNumber, units.rentAmount)
    .having(
      sql`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0) - 
          COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0) > ${minBalance}`
    );

  let result: ArrearsTenant[] = rows.map((r) => {
    const balance = Number(r.totalDebit) - Number(r.totalCredit);
    const today = new Date();
    const lastPayment = r.lastPaymentDate ? new Date(r.lastPaymentDate) : null;
    const daysOverdue = lastPayment
      ? Math.max(0, Math.floor((today.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24)) - 30)
      : 30;

    return {
      tenantId: r.tenantId,
      tenantName: r.fullName,
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
  });

  result.sort((a, b) => {
    const fieldA = sortBy === "amount" ? a.balance : a.daysOverdue;
    const fieldB = sortBy === "amount" ? b.balance : b.daysOverdue;
    return sortOrder === "asc" ? fieldA - fieldB : fieldB - fieldA;
  });

  return result;
}

// ── 5. Occupancy Trend (placeholder for V2 charts) ────────────────────────

export async function getOccupancyHistory(
  agencyId: string,
  months: number = 6
): Promise<{ month: string; occupied: number; vacant: number; rate: number }[]> {
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