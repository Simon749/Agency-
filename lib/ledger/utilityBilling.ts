// lib/ledger/utilityBilling.ts
// Utility billing logic — calculates charge from meter readings and inserts DEBIT.

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { utilityReadings, tenantLedger, units, buildings, tenants } from "@/db/schema";
import type { InsertUtilityReading, InsertTenantLedgerEntry } from "@/db/schema";

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
 * Returns null if no previous reading exists.
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
 * Idempotent: if a reading already exists for this unit + type + billingMonth,
 * it updates the existing record instead of creating a duplicate.
 */
export async function submitMeterReading(
  input: MeterReadingInput
): Promise<MeterReadingResult> {
  const db = getDb();

  // Validate
  if (input.currentReading < input.previousReading) {
    throw new Error(
      `Current reading (${input.currentReading}) cannot be less than previous reading (${input.previousReading})`
    );
  }

  const unitsConsumed = input.currentReading - input.previousReading;
  const totalCharge = unitsConsumed * input.ratePerUnit;

  // Find the tenant in this unit
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

  // Get unit number for display
  const [unit] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, input.unitId))
    .limit(1);

  // Check for existing reading this month (idempotency)
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
    // Update existing reading
    await db
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

    readingId = existing.id;

    // Update existing ledger entry if linked
    if (existing.ledgerEntryId) {
      await db
        .update(tenantLedger)
        .set({
          amount: totalCharge.toFixed(2),
          description: `${input.utilityType} — ${formatMonthLabel(input.billingMonth)} (${unitsConsumed.toFixed(2)} units @ KES ${input.ratePerUnit.toFixed(2)})`,
        })
        .where(eq(tenantLedger.id, existing.ledgerEntryId));

      ledgerEntryId = existing.ledgerEntryId;
    } else {
      // Create new ledger entry if not previously linked
      const [ledger] = await db
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
        })
        .returning({ id: tenantLedger.id });

      ledgerEntryId = ledger.id;

      // Link back
      await db
        .update(utilityReadings)
        .set({ ledgerEntryId })
        .where(eq(utilityReadings.id, readingId));
    }
  } else {
    // Insert new reading
    const [reading] = await db
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

    readingId = reading.id;

    // Insert DEBIT into tenant_ledger
    const [ledger] = await db
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
      })
      .returning({ id: tenantLedger.id });

    ledgerEntryId = ledger.id;

    // Link reading back to ledger
    await db
      .update(utilityReadings)
      .set({ ledgerEntryId })
      .where(eq(utilityReadings.id, readingId));
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