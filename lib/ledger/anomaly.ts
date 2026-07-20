// lib/ledger/anomaly.ts
// Phase D: Flag utility readings that deviate significantly from historical average.
// Prevents billing errors and potential fraud (e.g., inflated readings).

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { utilityReadings, tenantLedger } from "@/db/schema";
import { log, alert } from "@/lib/monitoring";

const ANOMALY_THRESHOLD_PERCENT = 50; // Flag if >50% above trailing average

export interface AnomalyCheckResult {
  isAnomaly: boolean;
  previousAverage: number;
  currentReading: number;
  deviationPercent: number;
  message: string;
}

/**
 * Check if a utility reading is anomalous compared to the tenant's history.
 * 
 * Logic:
 *   1. Get last 3 readings for this unit + utility type
 *   2. Calculate average units consumed
 *   3. Flag if current consumption > average × (1 + threshold)
 */
export async function checkReadingAnomaly(
  unitId: string,
  utilityType: "WATER" | "ELECTRICITY",
  currentReading: number,
  previousReading: number
): Promise<AnomalyCheckResult> {
  const db = getDb();
  const unitsConsumed = currentReading - previousReading;

  // Get last 3 historical readings (excluding the current one being checked)
  const history = await db
    .select({
      unitsConsumed: utilityReadings.unitsConsumed,
      createdAt: utilityReadings.createdAt,
    })
    .from(utilityReadings)
    .where(
      and(
        eq(utilityReadings.unitId, unitId),
        eq(utilityReadings.utilityType, utilityType)
      )
    )
    .orderBy(desc(utilityReadings.createdAt))
    .limit(3);

  if (history.length < 2) {
    // Not enough history to establish a baseline
    return {
      isAnomaly: false,
      previousAverage: 0,
      currentReading: unitsConsumed,
      deviationPercent: 0,
      message: "Insufficient history for anomaly detection (need 2+ previous readings)",
    };
  }

  const avgConsumption =
    history.reduce((sum, h) => sum + Number(h.unitsConsumed), 0) / history.length;

  if (avgConsumption === 0) {
    return {
      isAnomaly: unitsConsumed > 10, // Arbitrary: flag if >10 units with zero history
      previousAverage: 0,
      currentReading: unitsConsumed,
      deviationPercent: 0,
      message: "Previous average is zero — any consumption is flagged for review",
    };
  }

  const deviationPercent = ((unitsConsumed - avgConsumption) / avgConsumption) * 100;
  const isAnomaly = deviationPercent > ANOMALY_THRESHOLD_PERCENT;

  if (isAnomaly) {
    alert("UTILITY_ANOMALY", 
      `Anomalous ${utilityType} reading for unit ${unitId}: ${unitsConsumed.toFixed(2)} units ` +
      `(${deviationPercent.toFixed(1)}% above trailing 3-month average of ${avgConsumption.toFixed(2)})`, {
      metadata: { unitId, utilityType, unitsConsumed, avgConsumption, deviationPercent },
    });
  }

  return {
    isAnomaly,
    previousAverage: avgConsumption,
    currentReading: unitsConsumed,
    deviationPercent,
    message: isAnomaly
      ? `Reading is ${deviationPercent.toFixed(1)}% above average — requires manager review`
      : "Reading within normal range",
  };
}

/**
 * Get all flagged anomalous readings for manager review.
 */
export async function getFlaggedReadings(agencyId: string) {
  const db = getDb();

  // This assumes you add a `flaggedForReview` boolean to utilityReadings
  // Or query based on a separate anomalies table
  return db
    .select()
    .from(utilityReadings)
    .where(
      and(
        eq(utilityReadings.agencyId, agencyId),
        sql`${utilityReadings.unitsConsumed} > (
          SELECT AVG(ur2.units_consumed) * 1.5
          FROM utility_readings ur2
          WHERE ur2.unit_id = ${utilityReadings.unitId}
          AND ur2.utility_type = ${utilityReadings.utilityType}
          AND ur2.created_at < ${utilityReadings.createdAt}
          LIMIT 3
        )`
      )
    )
    .orderBy(desc(utilityReadings.createdAt));
}