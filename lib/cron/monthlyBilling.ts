// lib/cron/monthlyBilling.ts
// Core monthly billing logic — idempotent, scoped per agency.
// Called by the cron API route and the manual trigger page.

import { eq, and, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  tenants,
  leases,
  units,
  buildings,
  buildingUtilities,
  tenantLedger,
} from "@/db/schema";

export interface BillingResult {
  tenantId: string;
  tenantName: string;
  buildingId: string;
  unitId: string;
  agencyId: string;
  entries: BillingEntry[];
  errors?: string[];
}

export interface BillingEntry {
  category: string;
  amount: number;
  description: string;
  billingMonth: string;
}

export interface MonthlyBillingSummary {
  billingMonth: string;
  totalTenants: number;
  totalEntriesInserted: number;
  totalAmountBilled: number;
  skipped: number;
  errors: number;
  details: BillingResult[];
}

/**
 * Run monthly billing for ALL active tenants across all agencies.
 * Idempotent: skips if DEBITs already exist for the billingMonth.
 */
export async function runMonthlyBilling(
  targetMonth?: string
): Promise<MonthlyBillingSummary> {
  const db = getDb();
  const billingMonth = targetMonth ?? getCurrentBillingMonth();

  // 1. Fetch all ACTIVE tenants with their active lease + unit + building
  const activeTenants = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.fullName,
      agencyId: tenants.agencyId,
      buildingId: tenants.buildingId,
      unitId: tenants.unitId,
      rentAmount: leases.rentAmount,
      depositAmount: leases.depositAmount,
      depositPaid: leases.depositPaid,
    })
    .from(tenants)
    .innerJoin(leases, eq(leases.tenantId, tenants.id))
    .where(
      and(
        eq(tenants.status, "ACTIVE"),
        eq(leases.status, "ACTIVE")
      )
    );

  const summary: MonthlyBillingSummary = {
    billingMonth,
    totalTenants: activeTenants.length,
    totalEntriesInserted: 0,
    totalAmountBilled: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  for (const tenant of activeTenants) {
    const result: BillingResult = {
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      buildingId: tenant.buildingId,
      unitId: tenant.unitId,
      agencyId: tenant.agencyId,
      entries: [],
      errors: [],
    };

    try {
      // ── Idempotency check ──
      // If any DEBIT already exists for this tenant + billingMonth, skip entirely.
      const existingDebits = await db
        .select({ id: tenantLedger.id })
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.tenantId, tenant.tenantId),
            eq(tenantLedger.billingMonth, billingMonth),
            eq(tenantLedger.type, "DEBIT")
          )
        )
        .limit(1);

      if (existingDebits.length > 0) {
        summary.skipped++;
        result.errors?.push(`Already billed for ${billingMonth}`);
        summary.details.push(result);
        continue;
      }

      // ── 1. Previous Balance (arrears) ──
      const prevBalance = await getPreviousMonthBalance(tenant.tenantId, billingMonth);
      if (prevBalance > 0) {
        result.entries.push({
          category: "PREVIOUS_BALANCE",
          amount: prevBalance,
          description: `Arrears carried forward — ${billingMonth}`,
          billingMonth,
        });
      }

      // ── 2. Current Month Rent ──
      const rentAmount = Number(tenant.rentAmount);
      result.entries.push({
        category: "RENT",
        amount: rentAmount,
        description: `Rent — ${formatMonthLabel(billingMonth)}`,
        billingMonth,
      });

      // ── 3. Fixed Building Utilities ──
      const fixedUtilities = await db
        .select()
        .from(buildingUtilities)
        .where(
          and(
            eq(buildingUtilities.buildingId, tenant.buildingId),
            eq(buildingUtilities.agencyId, tenant.agencyId),
            eq(buildingUtilities.isEnabled, true),
            eq(buildingUtilities.rateType, "FIXED")
          )
        );

      for (const util of fixedUtilities) {
        const amount = Number(util.defaultAmount ?? 0);
        if (amount <= 0) continue;

        result.entries.push({
          category: util.name,
          amount,
          description: `${util.name} — ${formatMonthLabel(billingMonth)}`,
          billingMonth,
        });
      }

      // ── 4. Deposit (if not yet paid) ──
      if (!tenant.depositPaid) {
        const depositAmount = Number(tenant.depositAmount);
        // Only bill deposit once — check if deposit DEBIT already exists ever
        const existingDeposit = await db
          .select({ id: tenantLedger.id })
          .from(tenantLedger)
          .where(
            and(
              eq(tenantLedger.tenantId, tenant.tenantId),
              eq(tenantLedger.category, "DEPOSIT"),
              eq(tenantLedger.type, "DEBIT")
            )
          )
          .limit(1);

        if (existingDeposit.length === 0) {
          result.entries.push({
            category: "DEPOSIT",
            amount: depositAmount,
            description: `Security Deposit`,
            billingMonth,
          });
        }
      }

      // ── Insert all DEBITs into tenant_ledger ──
      for (const entry of result.entries) {
        await db.insert(tenantLedger).values({
          tenantId: tenant.tenantId,
          buildingId: tenant.buildingId,
          agencyId: tenant.agencyId,
          type: "DEBIT",
          category: entry.category as any,
          amount: entry.amount.toFixed(2),
          description: entry.description,
          billingMonth: entry.billingMonth,
          method: "SYSTEM",
          recordedBy: "system",
        });

        summary.totalEntriesInserted++;
        summary.totalAmountBilled += entry.amount;
      }

      summary.details.push(result);
    } catch (err) {
      summary.errors++;
      result.errors?.push(err instanceof Error ? err.message : String(err));
      summary.details.push(result);
    }
  }

  return summary;
}

/**
 * Calculate the previous month's closing balance.
 * Sums all DEBITs minus all CREDITs up to the end of the previous month.
 */
async function getPreviousMonthBalance(
  tenantId: string,
  currentBillingMonth: string
): Promise<number> {
  const db = getDb();

  // Parse current month to get previous month
  const [year, month] = currentBillingMonth.split("-").map(Number);
  const prevDate = new Date(year, month - 1, 0); // last day of previous month
  const prevMonthStr = prevDate.toISOString().slice(0, 7); // "2026-05"

  // Get all ledger entries up to and including the previous billing month
  const entries = await db
    .select({ type: tenantLedger.type, amount: tenantLedger.amount })
    .from(tenantLedger)
    .where(
      and(
        eq(tenantLedger.tenantId, tenantId),
        lte(tenantLedger.billingMonth, prevMonthStr)
      )
    );

  let debits = 0;
  let credits = 0;

  for (const entry of entries) {
    const amount = Number(entry.amount);
    if (entry.type === "DEBIT") {
      debits += amount;
    } else {
      credits += amount;
    }
  }

  const balance = debits - credits;
  return balance > 0 ? balance : 0; // only carry forward if they owe
}

function getCurrentBillingMonth(): string {
  const now = new Date();
  return now.toISOString().slice(0, 7); // "2026-06"
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}