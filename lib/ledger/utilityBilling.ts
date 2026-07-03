// lib/ledger/utilityBilling.ts
// PHASE 4 FIX: Ledger immutability — never UPDATE tenant_ledger.
// When correcting a reading, we void the old charge (CREDIT reversal) and insert a new DEBIT.

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { utilityReadings, tenantLedger, units, buildings, tenants } from "@/db/schema";
import type { InsertUtilityReading } from "@/db/schema";

export interface MeterReadingInput {
  unitId: string;
  buildingId: string;
  agencyId: string;
  agentClerkId: string;
  utilityType: "WATER" | "ELECTRICITY";
  previousReading: number;
  currentReading: number;
  ratePerUnit: number;
  billingMonth: string;
}

export interface MeterReadingResult {
  readingId: string;
  ledgerEntryId: string;
  unitsConsumed: number;
  totalCharge: number;
  tenantId: string;
  tenantName: string;
  unitNumber: string;
}

/**
 * Get the most recent utility reading for a unit + utility type.
 */
export async function getLastReading(
  unitId: string,
  utilityType: "WATER" | "ELECTRICITY"
): Promise<{ currentReading: number; ratePerUnit: number } | null> {
  const db = getDb();

  const [last] = await db
    .select({
      currentReading: utilityReadings.currentReading,
      ratePerUnit: utilityReadings.ratePerUnit,
    })
    .from(utilityReadings)
    .where(
      and(
        eq(utilityReadings.unitId, unitId),
        eq(utilityReadings.utilityType, utilityType)
      )
    )
    .orderBy(desc(utilityReadings.createdAt))
    .limit(1);

  return last
    ? {
        currentReading: Number(last.currentReading),
        ratePerUnit: Number(last.ratePerUnit),
      }
    : null;
}

/**
 * Submit a meter reading, calculate charge, and bill the tenant.
 *
 * PHASE 4 FIX: If a reading already exists for this unit + type + billingMonth,
 * we VOID the old ledger entry (insert CREDIT reversal) and create a NEW DEBIT.
 * Never UPDATE tenant_ledger — it is append-only.
 */
export async function submitMeterReading(
  input: MeterReadingInput
): Promise<MeterReadingResult> {
  const db = getDb();

  // ── Validation ──
  if (input.currentReading < input.previousReading) {
    throw new Error(
      `Current reading (${input.currentReading}) cannot be less than previous reading (${input.previousReading})`
    );
  }

  const unitsConsumed = input.currentReading - input.previousReading;
  const totalCharge = unitsConsumed * input.ratePerUnit;

  // ── Find tenant ──
  const [tenant] = await db
    .select({
      id: tenants.id,
      fullName: tenants.fullName,
      unitId: tenants.unitId,
    })
    .from(tenants)
    .where(
      and(
        eq(tenants.unitId, input.unitId),
        eq(tenants.buildingId, input.buildingId),
        eq(tenants.agencyId, input.agencyId),
        eq(tenants.status, "ACTIVE")
      )
    )
    .limit(1);

  if (!tenant) {
    throw new Error("No active tenant found in this unit");
  }

  // ── Get unit number ──
  const [unit] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, input.unitId))
    .limit(1);

  // ── Check for existing reading this month ──
  const [existing] = await db
    .select({ id: utilityReadings.id, ledgerEntryId: utilityReadings.ledgerEntryId })
    .from(utilityReadings)
    .where(
      and(
        eq(utilityReadings.unitId, input.unitId),
        eq(utilityReadings.utilityType, input.utilityType),
        eq(utilityReadings.billingMonth, input.billingMonth)
      )
    )
    .limit(1);

  let readingId: string;
  let ledgerEntryId: string;

  if (existing) {
    // ═══════════════════════════════════════════════════════════════
    // PHASE 4 FIX: Void old ledger entry + insert new one
    // ═══════════════════════════════════════════════════════════════
    const result = await db.transaction(async (tx) => {
      // 1. Get old charge amount for reversal
      let oldAmount = 0;
      if (existing.ledgerEntryId) {
        const [oldLedger] = await tx
          .select({ amount: tenantLedger.amount })
          .from(tenantLedger)
          .where(eq(tenantLedger.id, existing.ledgerEntryId))
          .limit(1);
        oldAmount = Number(oldLedger?.amount ?? 0);

        // 2. Insert REVERSAL CREDIT (voids old charge)
        if (oldAmount > 0) {
          await tx.insert(tenantLedger).values({
            tenantId: tenant.id,
            buildingId: input.buildingId,
            agencyId: input.agencyId,
            type: "CREDIT",
            category: input.utilityType,
            amount: oldAmount.toFixed(2),
            description: `Reversal — corrected ${input.utilityType} reading for ${formatMonthLabel(input.billingMonth)}`,
            billingMonth: input.billingMonth,
            method: "SYSTEM",
            recordedBy: input.agentClerkId,
            referenceCode: `REV-${existing.ledgerEntryId.slice(0, 8)}`,
          });
        }
      }

      // 3. Update the utility_readings row with new values
      await tx
        .update(utilityReadings)
        .set({
          previousReading: input.previousReading.toFixed(2),
          currentReading: input.currentReading.toFixed(2),
          unitsConsumed: unitsConsumed.toFixed(2),
          ratePerUnit: input.ratePerUnit.toFixed(2),
          totalCharge: totalCharge.toFixed(2),
          agentClerkId: input.agentClerkId,
        })
        .where(eq(utilityReadings.id, existing.id));

      // 4. Insert NEW DEBIT with corrected amount
      const [newLedger] = await tx
        .insert(tenantLedger)
        .values({
          tenantId: tenant.id,
          buildingId: input.buildingId,
          agencyId: input.agencyId,
          type: "DEBIT",
          category: input.utilityType,
          amount: totalCharge.toFixed(2),
          description: `${input.utilityType} — corrected reading for ${formatMonthLabel(input.billingMonth)} (${unitsConsumed.toFixed(2)} units @ KES ${input.ratePerUnit.toFixed(2)})`,
          billingMonth: input.billingMonth,
          method: "SYSTEM",
          recordedBy: input.agentClerkId,
          referenceCode: `CORR-${existing.id.slice(0, 8)}-${Date.now()}`,
        })
        .returning({ id: tenantLedger.id });

      // 5. Link reading to NEW ledger entry
      await tx
        .update(utilityReadings)
        .set({ ledgerEntryId: newLedger.id })
        .where(eq(utilityReadings.id, existing.id));

      return { readingId: existing.id, ledgerEntryId: newLedger.id };
    });

    readingId = result.readingId;
    ledgerEntryId = result.ledgerEntryId;
  } else {
    // ── New reading ──
    const result = await db.transaction(async (tx) => {
      const [reading] = await tx
        .insert(utilityReadings)
        .values({
          unitId: input.unitId,
          buildingId: input.buildingId,
          agencyId: input.agencyId,
          agentClerkId: input.agentClerkId,
          utilityType: input.utilityType,
          previousReading: input.previousReading.toFixed(2),
          currentReading: input.currentReading.toFixed(2),
          unitsConsumed: unitsConsumed.toFixed(2),
          ratePerUnit: input.ratePerUnit.toFixed(2),
          totalCharge: totalCharge.toFixed(2),
          billingMonth: input.billingMonth,
        })
        .returning({ id: utilityReadings.id });

      const [ledger] = await tx
        .insert(tenantLedger)
        .values({
          tenantId: tenant.id,
          buildingId: input.buildingId,
          agencyId: input.agencyId,
          type: "DEBIT",
          category: input.utilityType,
          amount: totalCharge.toFixed(2),
          description: `${input.utilityType} — ${formatMonthLabel(input.billingMonth)} (${unitsConsumed.toFixed(2)} units @ KES ${input.ratePerUnit.toFixed(2)})`,
          billingMonth: input.billingMonth,
          method: "SYSTEM",
          recordedBy: input.agentClerkId,
          referenceCode: `RDG-${reading.id.slice(0, 8)}`,
        })
        .returning({ id: tenantLedger.id });

      await tx
        .update(utilityReadings)
        .set({ ledgerEntryId: ledger.id })
        .where(eq(utilityReadings.id, reading.id));

      return { readingId: reading.id, ledgerEntryId: ledger.id };
    });

    readingId = result.readingId;
    ledgerEntryId = result.ledgerEntryId;
  }

  return {
    readingId,
    ledgerEntryId,
    unitsConsumed,
    totalCharge,
    tenantId: tenant.id,
    tenantName: tenant.fullName,
    unitNumber: unit?.unitNumber ?? "—",
  };
}

/**
 * Get reading history for a unit + utility type.
 */
export async function getReadingHistory(
  unitId: string,
  utilityType: "WATER" | "ELECTRICITY",
  limit: number = 12
) {
  const db = getDb();

  return db
    .select()
    .from(utilityReadings)
    .where(
      and(
        eq(utilityReadings.unitId, unitId),
        eq(utilityReadings.utilityType, utilityType)
      )
    )
    .orderBy(desc(utilityReadings.createdAt))
    .limit(limit);
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}