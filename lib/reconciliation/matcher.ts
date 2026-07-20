// lib/reconciliation/matcher.ts
// Match Daraja settlement transactions against tenant_ledger CREDIT rows.
// Returns discrepancies for investigation.

import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  tenantLedger,
  reconciliationDiscrepancies,
  tenants,
  InsertReconciliationDiscrepancy,
} from "@/db/schema";
import type { DarajaTransaction, SettlementReport } from "@/lib/daraja/settlement";
import { log, alert } from "@/lib/monitoring";

export interface ReconciliationResult {
  buildingId: string;
  reportDate: string;
  matched: number;
  discrepancies: number;
  details: Array<{
    type: string;
    darajaTransId?: string;
    ledgerRef?: string;
    amount?: number;
    reason: string;
  }>;
}

/**
 * Reconcile a single building's settlement report against the ledger.
 * 
 * Matching rules:
 *   1. TransID (from Daraja) == referenceCode (in ledger) → exact match
 *   2. Amount must match within 0.01 KES tolerance
 *   3. BillRefNumber should resolve to a valid tenant in this building
 */
export async function reconcileBuildingReport(
  report: SettlementReport
): Promise<ReconciliationResult> {
  const db = getDb();
  const { buildingId, reportDate, transactions } = report;

  const result: ReconciliationResult = {
    buildingId,
    reportDate,
    matched: 0,
    discrepancies: 0,
    details: [],
  };

  if (transactions.length === 0) {
    log("info", `No transactions in settlement report for building ${buildingId}`, {
      service: "reconciliation",
      metadata: { buildingId, reportDate },
    });
    return result;
  }

  // Fetch all ledger CREDITs for this building with reference codes
  const ledgerCredits = await db
    .select({
      id: tenantLedger.id,
      referenceCode: tenantLedger.referenceCode,
      amount: tenantLedger.amount,
      tenantId: tenantLedger.tenantId,
      recordedBy: tenantLedger.recordedBy,
      createdAt: tenantLedger.createdAt,
    })
    .from(tenantLedger)
    .where(
      and(
        eq(tenantLedger.buildingId, buildingId),
        eq(tenantLedger.type, "CREDIT")
      )
    );

  // Build lookup maps
  const ledgerByRef = new Map<string, typeof ledgerCredits[0]>();
  for (const entry of ledgerCredits) {
    if (entry.referenceCode) {
      ledgerByRef.set(entry.referenceCode, entry);
    }
  }

  // Fetch tenant mapping for BillRefNumber validation
  const tenantIds = transactions
    .map((t) => t.BillRefNumber)
    .filter((id): id is string => !!id && id.length === 36); // UUID length

  const tenantMap = new Map<string, { id: string; fullName: string }>();
  if (tenantIds.length > 0) {
    const tenantRows = await db
      .select({ id: tenants.id, fullName: tenants.fullName })
      .from(tenants)
      .where(inArray(tenants.id, tenantIds));

    for (const t of tenantRows) {
      tenantMap.set(t.id, t);
    }
  }

  // Track which ledger entries were matched
  const matchedLedgerIds = new Set<string>();

  // ── Pass 1: Match Daraja transactions to ledger ──
  for (const tx of transactions) {
    const ledgerEntry = ledgerByRef.get(tx.TransID);

    if (!ledgerEntry) {
      // Daraja has a transaction we don't have in ledger
      await insertDiscrepancy({
        agencyId: "", // Will be filled from building lookup
        buildingId,
        discrepancyType: "LEDGER_MISSING",
        darajaTransactionId: tx.TransID,
        darajaAmount: parseFloat(tx.TransAmount),
        darajaPhone: tx.MSISDN,
        darajaTimestamp: tx.TransTime,
        reportDate,
        reason: `Daraja transaction ${tx.TransID} for KES ${tx.TransAmount} not found in tenant_ledger`,
      });

      result.discrepancies++;
      result.details.push({
        type: "LEDGER_MISSING",
        darajaTransId: tx.TransID,
        amount: parseFloat(tx.TransAmount),
        reason: "Transaction in Daraja but missing from ledger",
      });
      continue;
    }

    matchedLedgerIds.add(ledgerEntry.id);

    // Check amount match (within 0.01 tolerance)
    const darajaAmount = parseFloat(tx.TransAmount);
    const ledgerAmount = parseFloat(String(ledgerEntry.amount));
    const amountDiff = Math.abs(darajaAmount - ledgerAmount);

    if (amountDiff > 0.01) {
      await insertDiscrepancy({
        agencyId: "", // Will be filled from building lookup
        buildingId,
        discrepancyType: "AMOUNT_MISMATCH",
        darajaTransactionId: tx.TransID,
        darajaAmount: darajaAmount,
        ledgerEntryId: ledgerEntry.id,
        ledgerReferenceCode: ledgerEntry.referenceCode,
        ledgerAmount: ledgerAmount,
        ledgerTenantId: ledgerEntry.tenantId,
        reportDate,
        reason: `Amount mismatch: Daraja shows KES ${darajaAmount}, ledger shows KES ${ledgerAmount}`,
      });

      result.discrepancies++;
      result.details.push({
        type: "AMOUNT_MISMATCH",
        darajaTransId: tx.TransID,
        ledgerRef: ledgerEntry.referenceCode ?? undefined,
        amount: darajaAmount,
        reason: `Amount mismatch: Daraja KES ${darajaAmount} vs Ledger KES ${ledgerAmount}`,
      });
      continue;
    }

    // Check tenant validity
    const tenant = tenantMap.get(tx.BillRefNumber);
    if (!tenant && tx.BillRefNumber) {
      await insertDiscrepancy({
        agency_Id: "",
        buildingId,
        discrepancyType: "TENANT_MISMATCH",
        darajaTransactionId: tx.TransID,
        darajaAmount: darajaAmount,
        reportDate,
        reason: `BillRefNumber ${tx.BillRefNumber} does not match any tenant in this building`,
      });

      result.discrepancies++;
      result.details.push({
        type: "TENANT_MISMATCH",
        darajaTransId: tx.TransID,
        reason: `Invalid BillRefNumber: ${tx.BillRefNumber}`,
      });
      continue;
    }

    // ✅ Match!
    result.matched++;
  }

  // ── Pass 2: Find ledger entries with no Daraja match ──
  for (const entry of ledgerCredits) {
    if (entry.referenceCode && !matchedLedgerIds.has(entry.id)) {
      await insertDiscrepancy({
        agency_Id: "",
        buildingId,
        discrepancyType: "DARAJA_MISSING",
        ledgerEntryId: entry.id,
        ledgerReferenceCode: entry.referenceCode,
        ledgerAmount: parseFloat(String(entry.amount)),
        ledgerTenantId: entry.tenantId,
        reportDate,
        reason: `Ledger CREDIT ${entry.referenceCode} for KES ${entry.amount} not found in Daraja settlement`,
      });

      result.discrepancies++;
      result.details.push({
        type: "DARAJA_MISSING",
        ledgerRef: entry.referenceCode,
        amount: parseFloat(String(entry.amount)),
        reason: "Ledger entry not found in Daraja settlement",
      });
    }
  }

  // Alert if significant discrepancies found
  if (result.discrepancies > 0) {
    alert("RECONCILIATION_MISMATCH", 
      `Building ${buildingId}: ${result.discrepancies} discrepancies found in ${reportDate} settlement`, {
      metadata: {
        buildingId,
        reportDate,
        matched: result.matched,
        discrepancies: result.discrepancies,
        details: result.details,
      },
    });
  }

  log("info", `Reconciliation complete for building ${buildingId}`, {
    service: "reconciliation",
    metadata: {
      buildingId,
      reportDate,
      matched: result.matched,
      discrepancies: result.discrepancies,
    },
  });

  return result;
}

/**
 * Insert a discrepancy record. Fills agencyId from building lookup.
 */
async function insertDiscrepancy(
  data: Omit<InsertReconciliationDiscrepancy, "id" | "agencyId" | "createdAt">
): Promise<void> {
  const db = getDb();

  // Look up agencyId from building
  const { buildings } = await import("@/db/schema");
  const [building] = await db
    .select({ agencyId: buildings.agencyId })
    .from(buildings)
    .where(eq(buildings.id, data.buildingId))
    .limit(1);

  await db.insert(reconciliationDiscrepancies).values({
    ...data,
    agencyId: building?.agencyId ?? "",
  });
}

/**
 * Reconcile all buildings across all agencies.
 * Called by the nightly cron job.
 */
export async function runFullReconciliation(
  options?: { startDate?: string; endDate?: string }
): Promise<ReconciliationResult[]> {
  const { fetchAgencySettlementReports } = await import("@/lib/daraja/settlement");
  const { agencies } = await import("@/db/schema");
  const db = getDb();

  const allAgencies = await db.select({ id: agencies.id }).from(agencies);

  const allResults: ReconciliationResult[] = [];

  for (const agency of allAgencies) {
    try {
      const reports = await fetchAgencySettlementReports(agency.id, options);

      for (const report of reports) {
        const result = await reconcileBuildingReport(report);
        allResults.push(result);
      }
    } catch (err) {
      log("error", `Reconciliation failed for agency ${agency.id}`, {
        service: "reconciliation",
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  return allResults;
}