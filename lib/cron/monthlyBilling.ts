// lib/cron/monthlyBilling.ts
// PHASE 3 FIX: Transaction-wrapped batch inserts, global idempotency lock.

import { eq, and, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, leases, buildingUtilities, tenantLedger } from "@/db/schema";

export interface BillingResult {
  tenantId: string; tenantName: string; buildingId: string;
  unitId: string; agencyId: string; entries: BillingEntry[]; errors?: string[];
}
export interface BillingEntry {
  category: string; amount: number; description: string; billingMonth: string;
}
export interface MonthlyBillingSummary {
  jobsEnqueued: any;
  totalBuildings: any;
  billingMonth: string; totalTenants: number; totalEntriesInserted: number;
  totalAmountBilled: number; skipped: number; errors: number; details: BillingResult[];
}

export async function runMonthlyBilling(targetMonth?: string): Promise<MonthlyBillingSummary> {
  const db = getDb();
  const billingMonth = targetMonth ?? getCurrentBillingMonth();

  return db.transaction(async (tx) => {
    const [existingRentDebit] = await tx
      .select({ id: tenantLedger.id })
      .from(tenantLedger)
      .where(and(
        eq(tenantLedger.billingMonth, billingMonth),
        eq(tenantLedger.category, "RENT"),
        eq(tenantLedger.type, "DEBIT")
      ))
      .limit(1);

    if (existingRentDebit) {
      console.log(`[CRON] Billing already ran for ${billingMonth}. Skipping.`);
      return { billingMonth, totalTenants: 0, totalEntriesInserted: 0, totalAmountBilled: 0, skipped: 0, errors: 0, details: [] };
    }

    const activeTenants = await tx
      .select({
        tenantId: tenants.id, tenantName: tenants.fullName,
        agencyId: tenants.agencyId, buildingId: tenants.buildingId, unitId: tenants.unitId,
        rentAmount: leases.rentAmount, depositAmount: leases.depositAmount, depositPaid: leases.depositPaid,
      })
      .from(tenants)
      .innerJoin(leases, eq(leases.tenantId, tenants.id))
      .where(and(eq(tenants.status, "ACTIVE"), eq(leases.status, "ACTIVE")));

    const summary: MonthlyBillingSummary = {
      billingMonth, totalTenants: activeTenants.length,
      totalEntriesInserted: 0, totalAmountBilled: 0, skipped: 0, errors: 0, details: [],
    };

    const allEntries: Array<any> = [];

    for (const tenant of activeTenants) {
      const result: BillingResult = {
        tenantId: tenant.tenantId, tenantName: tenant.tenantName,
        buildingId: tenant.buildingId, unitId: tenant.unitId, agencyId: tenant.agencyId,
        entries: [], errors: [],
      };

      try {
        const prevBalance = await getPreviousMonthBalanceTx(tx, tenant.tenantId, billingMonth);
        if (prevBalance > 0) {
          result.entries.push({ category: "PREVIOUS_BALANCE", amount: prevBalance, description: `Arrears carried forward — ${billingMonth}`, billingMonth });
        }
        result.entries.push({ category: "RENT", amount: Number(tenant.rentAmount), description: `Rent — ${formatMonthLabel(billingMonth)}`, billingMonth });

        const fixedUtilities = await tx.select().from(buildingUtilities).where(and(
          eq(buildingUtilities.buildingId, tenant.buildingId),
          eq(buildingUtilities.agencyId, tenant.agencyId),
          eq(buildingUtilities.isEnabled, true),
          eq(buildingUtilities.rateType, "FIXED")
        ));

        for (const util of fixedUtilities) {
          const amount = Number(util.defaultAmount ?? 0);
          if (amount > 0) result.entries.push({ category: util.name, amount, description: `${util.name} — ${formatMonthLabel(billingMonth)}`, billingMonth });
        }

        if (!tenant.depositPaid) {
          const [existingDeposit] = await tx.select({ id: tenantLedger.id }).from(tenantLedger).where(and(
            eq(tenantLedger.tenantId, tenant.tenantId), eq(tenantLedger.category, "DEPOSIT"), eq(tenantLedger.type, "DEBIT")
          )).limit(1);
          if (!existingDeposit) {
            result.entries.push({ category: "DEPOSIT", amount: Number(tenant.depositAmount), description: `Security Deposit`, billingMonth });
          }
        }

        for (const entry of result.entries) {
          allEntries.push({
            tenantId: tenant.tenantId, buildingId: tenant.buildingId, agencyId: tenant.agencyId,
            type: "DEBIT", category: entry.category, amount: entry.amount.toFixed(2),
            description: entry.description, billingMonth: entry.billingMonth,
            method: "SYSTEM", recordedBy: "system",
            referenceCode: `${billingMonth}-${tenant.tenantId}-${entry.category}`,
          });
        }

        summary.totalAmountBilled += result.entries.reduce((s, e) => s + e.amount, 0);
        summary.details.push(result);
      } catch (err) {
        summary.errors++;
        result.errors?.push(err instanceof Error ? err.message : String(err));
        summary.details.push(result);
      }
    }

    if (allEntries.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < allEntries.length; i += CHUNK_SIZE) {
        await tx.insert(tenantLedger).values(allEntries.slice(i, i + CHUNK_SIZE) as any);
      }
      summary.totalEntriesInserted = allEntries.length;
    }

    return summary;
  });
}

async function getPreviousMonthBalanceTx(tx: any, tenantId: string, currentBillingMonth: string): Promise<number> {
  const [year, month] = currentBillingMonth.split("-").map(Number);
  const prevMonthStr = new Date(year, month - 1, 0).toISOString().slice(0, 7);
  const [result] = await tx.select({
    totalDebit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount} ELSE 0 END), 0)`,
    totalCredit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount} ELSE 0 END), 0)`,
  }).from(tenantLedger).where(and(eq(tenantLedger.tenantId, tenantId), lte(tenantLedger.billingMonth, prevMonthStr)));
  const balance = Number(result.totalDebit) - Number(result.totalCredit);
  return balance > 0 ? balance : 0;
}

function getCurrentBillingMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}