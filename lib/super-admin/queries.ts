// lib/super-admin/queries.ts
// System-wide analytics for Super Admin dashboard.
// No agencyId filter — sees everything across all agencies.

import { eq, count, sum, sql, and, desc, gte, lte, isNull, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  agencies,
  buildings,
  units,
  tenants,
  tenantLedger,
  agencySubscriptions,
  subscriptionPayments,
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
  // NEW: Subscription metrics
  mrrKes: number;
  totalOverdueAgencies: number;
  agenciesInTrial: number;
}

export interface AgencyListItem {
  isTerminated: any;
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  inviteStatus: string;
  subscriptionStatus: string;
  plan: string | null;
  amountKes: number | null;
  paidThroughDate: string | null;
  nextBillingDate: string | null;
  daysUntilDue: number | null;
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
    .where(and(eq(agencies.isActive, true), isNull(agencies.deletedAt)));

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

  // NEW: Subscription metrics
  const [mrrResult] = await db
    .select({ total: sum(agencySubscriptions.amountKes) })
    .from(agencySubscriptions)
    .where(eq(agencySubscriptions.status, "ACTIVE"));

  const [overdueCount] = await db
    .select({ count: count() })
    .from(agencySubscriptions)
    .where(eq(agencySubscriptions.status, "OVERDUE"));

  const [trialCount] = await db
    .select({ count: count() })
    .from(agencySubscriptions)
    .where(eq(agencySubscriptions.plan, "TRIAL"));

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
    mrrKes: Number(mrrResult?.total ?? 0),
    totalOverdueAgencies: Number(overdueCount?.count ?? 0),
    agenciesInTrial: Number(trialCount?.count ?? 0),
  };
}

// ── 2. Agency list with per-agency stats + subscription data ───────────────

export async function getAgencyList(): Promise<AgencyListItem[]> {
  const db = getDb();

  const agencyRows = await db
    .select({
      id: agencies.id,
      name: agencies.name,
      email: agencies.email,
      phone: agencies.phone,
      isActive: agencies.isActive,
      inviteStatus: sql<string>`'INVITED'`,
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

    // Fetch subscription data for this agency
    const [sub] = await db
      .select({
        plan: agencySubscriptions.plan,
        amountKes: agencySubscriptions.amountKes,
        paidThroughDate: agencySubscriptions.paidThroughDate,
        nextBillingDate: agencySubscriptions.nextBillingDate,
        status: agencySubscriptions.status,
      })
      .from(agencySubscriptions)
      .where(eq(agencySubscriptions.agencyId, a.id))
      .limit(1);

    const now = new Date();
    const daysUntilDue = sub?.nextBillingDate
      ? Math.ceil((new Date(sub.nextBillingDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    results.push({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      isActive: a.isActive,
      inviteStatus: a.inviteStatus,
      subscriptionStatus: sub?.status ?? a.subscriptionStatus ?? "TRIAL",
      plan: sub?.plan ?? null,
      amountKes: sub?.amountKes ? Number(sub.amountKes) : null,
      paidThroughDate: sub?.paidThroughDate ?? null,
      nextBillingDate: sub?.nextBillingDate ?? null,
      daysUntilDue,
      createdAt: a.createdAt,
      buildingCount: Number(bCount?.count ?? 0),
      unitCount: Number(uCount?.count ?? 0),
      tenantCount: Number(tCount?.count ?? 0),
      activeTenantCount: Number(atCount?.count ?? 0),
      lastActiveAt: lastActivity?.createdAt ?? null,
      isTerminated: undefined
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

// ── 4. Terminate agency (soft delete) ──────────────────────────────────────

export async function terminateAgency(
  agencyId: string,
  reason: "CONTRACT_ENDED" | "NON_PAYMENT" | "BREACH_OF_TERMS" | "REQUESTED_BY_AGENCY" | "OTHER",
  terminatedBy: string // Super Admin clerkUserId
): Promise<{ success: boolean; agencyName: string }> {
  const db = getDb();

  const [agency] = await db
    .select({ name: agencies.name })
    .from(agencies)
    .where(eq(agencies.id, agencyId));

  if (!agency) {
    throw new Error(`Agency ${agencyId} not found`);
  }

  const now = new Date();

  await db
    .update(agencies)
    .set({
      isActive: false,
      deletedAt: now,
      terminationReason: reason,
      terminatedBy,
    })
    .where(eq(agencies.id, agencyId));

  // Also mark subscription as cancelled
  await db
    .update(agencySubscriptions)
    .set({ status: "CANCELLED" })
    .where(eq(agencySubscriptions.agencyId, agencyId));

  console.log(`[TERMINATE] Agency ${agencyId} (${agency.name}) terminated. Reason: ${reason}`);

  return { success: true, agencyName: agency.name };
}

// ── 5. Get subscription details for an agency ──────────────────────────────

export async function getAgencySubscription(agencyId: string) {
  const db = getDb();

  const [sub] = await db
    .select()
    .from(agencySubscriptions)
    .where(eq(agencySubscriptions.agencyId, agencyId))
    .limit(1);

  if (!sub) return null;

  // Get payment history
  const payments = await db
    .select()
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.agencyId, agencyId))
    .orderBy(desc(subscriptionPayments.createdAt))
    .limit(10);

  return {
    subscription: sub,
    payments,
  };
}

// ── 6. Get overdue agencies for dunning ──────────────────────────────────

export async function getOverdueAgencies() {
  const db = getDb();

  const now = new Date();

  const rows = await db
    .select({
      agencyId: agencies.id,
      agencyName: agencies.name,
      agencyPhone: agencies.phone,
      plan: agencySubscriptions.plan,
      amountKes: agencySubscriptions.amountKes,
      nextBillingDate: agencySubscriptions.nextBillingDate,
      overdueSince: agencySubscriptions.overdueSince,
      gracePeriodDays: agencySubscriptions.gracePeriodDays,
      status: agencySubscriptions.status,
    })
    .from(agencySubscriptions)
    .innerJoin(agencies, eq(agencySubscriptions.agencyId, agencies.id))
    .where(
      and(
        eq(agencySubscriptions.status, "OVERDUE"),
        isNull(agencies.deletedAt)
      )
    )
    .orderBy(desc(agencySubscriptions.overdueSince));

  return rows.map((r) => ({
    ...r,
    daysOverdue: r.overdueSince
      ? Math.floor((now.getTime() - new Date(r.overdueSince).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
    gracePeriodDays: Number(r.gracePeriodDays ?? 7),
  }));
}