// lib/super-admin/queries.ts
// System-wide analytics for Super Admin dashboard.
// No agencyId filter — sees everything across all agencies.

import { eq, count, sum, sql, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  agencies,
  buildings,
  units,
  tenants,
  tenantLedger,
} from "@/db/schema";

export interface SystemMetrics {
  totalAgencies: number;
  activeAgencies: number;
  suspendedAgencies: number;
  totalBuildings: number;
  totalUnits: number;
  occupiedUnits: number;
  totalTenants: number;
  activeTenants: number;
  totalRentCollectedThisMonth: number;
  totalOutstandingBalance: number;
}

export interface AgencyListItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  inviteStatus: string;         // ← tracks INVITED / ACCEPTED
  subscriptionStatus: string;
  createdAt: Date;
  buildingCount: number;
  unitCount: number;
  tenantCount: number;
  activeTenantCount: number;
  lastActiveAt: Date | null;
}

// ── 1. System-wide KPIs ────────────────────────────────────────────────────

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const db = getDb();

  const [agencyCount] = await db.select({ count: count() }).from(agencies);
  const [activeAgencyCount] = await db
    .select({ count: count() })
    .from(agencies)
    .where(eq(agencies.isActive, true));

  const [buildingCount] = await db.select({ count: count() }).from(buildings);
  const [unitCount] = await db.select({ count: count() }).from(units);
  const [occupiedCount] = await db
    .select({ count: count() })
    .from(units)
    .where(eq(units.isOccupied, true));

  const [tenantCount] = await db.select({ count: count() }).from(tenants);
  const [activeTenantCount] = await db
    .select({ count: count() })
    .from(tenants)
    .where(and(eq(tenants.status, "ACTIVE"), eq(tenants.inviteStatus, "ACCEPTED")));

  // Rent collected this month (all agencies)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [collected] = await db
    .select({ total: sum(tenantLedger.amount) })
    .from(tenantLedger)
    .where(
      and(
        eq(tenantLedger.type, "CREDIT"),
        eq(tenantLedger.category, "RENT"),
        sql`${tenantLedger.createdAt} >= ${monthStart}`
      )
    );

  // Total outstanding across all tenants
  const balanceRows = await db
    .select({
      tenantId: tenants.id,
      totalDebit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(tenants)
    .leftJoin(tenantLedger, eq(tenants.id, tenantLedger.tenantId))
    .groupBy(tenants.id);

  const totalOutstanding = balanceRows.reduce((sum, row) => {
    const balance = Number(row.totalDebit) - Number(row.totalCredit);
    return sum + Math.max(0, balance);
  }, 0);

  return {
    totalAgencies: Number(agencyCount?.count ?? 0),
    activeAgencies: Number(activeAgencyCount?.count ?? 0),
    suspendedAgencies: Number(agencyCount?.count ?? 0) - Number(activeAgencyCount?.count ?? 0),
    totalBuildings: Number(buildingCount?.count ?? 0),
    totalUnits: Number(unitCount?.count ?? 0),
    occupiedUnits: Number(occupiedCount?.count ?? 0),
    totalTenants: Number(tenantCount?.count ?? 0),
    activeTenants: Number(activeTenantCount?.count ?? 0),
    totalRentCollectedThisMonth: Number(collected?.total ?? 0),
    totalOutstandingBalance: totalOutstanding,
  };
}

// ── 2. Agency list with per-agency stats ───────────────────────────────────

export async function getAgencyList(): Promise<AgencyListItem[]> {
  const db = getDb();

  // FIX: inviteStatus removed from select — not on agencies table
  const agencyRows = await db
    .select({
      id: agencies.id,
      name: agencies.name,
      email: agencies.email,
      phone: agencies.phone,
      // agencies table doesn't have inviteStatus; expose a default literal
      inviteStatus: sql<string>`'INVITED'`,
      isActive: agencies.isActive,
      subscriptionStatus: agencies.subscriptionStatus,
      createdAt: agencies.createdAt,
    })
    .from(agencies)
    .orderBy(desc(agencies.createdAt));

  const results: AgencyListItem[] = [];

  for (const a of agencyRows) {
    const [bCount] = await db
      .select({ count: count() })
      .from(buildings)
      .where(eq(buildings.agencyId, a.id));

    const [uCount] = await db
      .select({ count: count() })
      .from(units)
      .where(eq(units.agencyId, a.id));

    const [tCount] = await db
      .select({ count: count() })
      .from(tenants)
      .where(eq(tenants.agencyId, a.id));

    const [atCount] = await db
      .select({ count: count() })
      .from(tenants)
      .where(
        and(
          eq(tenants.agencyId, a.id),
          eq(tenants.status, "ACTIVE"),
          eq(tenants.inviteStatus, "ACCEPTED")
        )
      );

    const [lastActivity] = await db
      .select({ createdAt: tenantLedger.createdAt })
      .from(tenantLedger)
      .where(eq(tenantLedger.agencyId, a.id))
      .orderBy(desc(tenantLedger.createdAt))
      .limit(1);

    // FIX: inviteStatus added to push — was missing, caused TS error 2345
    results.push({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      isActive: a.isActive,
    inviteStatus: a.inviteStatus,
      subscriptionStatus: a.subscriptionStatus ?? "TRIAL",
      createdAt: a.createdAt,
      buildingCount: Number(bCount?.count ?? 0),
      unitCount: Number(uCount?.count ?? 0),
      tenantCount: Number(tCount?.count ?? 0),
      activeTenantCount: Number(atCount?.count ?? 0),
      lastActiveAt: lastActivity?.createdAt ?? null,
    });
  }

  return results;
}

// ── 3. Toggle agency active status (kill switch) ───────────────────────────

export async function toggleAgencyStatus(
  agencyId: string,
  isActive: boolean
): Promise<{ success: boolean; agencyName: string }> {
  const db = getDb();

  const [agency] = await db
    .select({ name: agencies.name })
    .from(agencies)
    .where(eq(agencies.id, agencyId));

  if (!agency) {
    throw new Error(`Agency ${agencyId} not found`);
  }

  await db
    .update(agencies)
    .set({ isActive })
    .where(eq(agencies.id, agencyId));

  console.log(`[KILL SWITCH] Agency ${agencyId} (${agency.name}) set to isActive=${isActive}`);

  return { success: true, agencyName: agency.name };
}