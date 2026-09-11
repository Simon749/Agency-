// app/api/jobs/bill-building/route.ts
// PHASE F: Batch worker — processes all tenants in ONE building.
// Called by QStash fan-out. Idempotent, resumable, observable.

import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, buildings, buildingUtilities, units, tenantLedger, billingRuns } from "@/db/schema";
import type { InsertTenantLedgerEntry } from "@/db/schema";
import { verifyQStashSignature } from "@/lib/qstash";

// ── Types ─────────────────────────────────────────────────────────────────
interface BillBuildingPayload {
    billingRunId: string;   // FK to billing_runs table
    buildingId: string;     // Which building to bill
    agencyId: string;       // Agency scope (security)
    billingMonth: string;    // "2026-07"
}

// ── POST handler (called by QStash) ───────────────────────────────────────
export async function POST(req: NextRequest) {
    const startTime = Date.now();

    // ── 1. Verify QStash signature (Phase 0 audit fix) ─────────────────────
    // Previously this only checked that an `upstash-signature` header was
    // PRESENT, not that it was valid — any caller could set that header to
    // any string and this route would proceed to insert real DEBIT ledger
    // entries. Now verifies the signature cryptographically against
    // QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY.
    const bodyText = await req.text();
    const isValid = await verifyQStashSignature(req, bodyText);
    if (!isValid) {
        return NextResponse.json({ error: "Invalid or missing QStash signature" }, { status: 401 });
    }

    // ── 2. Parse payload ───────────────────────────────────────────────────
    let payload: BillBuildingPayload;
    try {
        payload = JSON.parse(bodyText);
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const { billingRunId, buildingId, agencyId, billingMonth } = payload;
    if (!billingRunId || !buildingId || !agencyId || !billingMonth) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();

    // ── 3. Mark billing run as RUNNING ─────────────────────────────────────
    const [run] = await db
        .select()
        .from(billingRuns)
        .where(eq(billingRuns.id, billingRunId))
        .limit(1);

    if (!run) {
        return NextResponse.json({ error: "Billing run not found" }, { status: 404 });
    }

    if (run.status === "COMPLETE") {
        // Already done — idempotent return
        return NextResponse.json({
            success: true,
            message: "Billing run already completed",
            billingRunId,
            skipped: true,
        });
    }

    if (run.attemptCount >= run.maxAttempts) {
        await db
            .update(billingRuns)
            .set({ status: "FAILED" })
            .where(eq(billingRuns.id, billingRunId));
        return NextResponse.json({ error: "Max retry attempts exceeded" }, { status: 400 });
    }

    // Increment attempt count and mark RUNNING
    await db
        .update(billingRuns)
        .set({
            status: "RUNNING",
            attemptCount: sql`${billingRuns.attemptCount} + 1`,
            startedAt: new Date(),
        })
        .where(eq(billingRuns.id, billingRunId));

    // ── 4. Fetch building + utilities ──────────────────────────────────────
    const [building] = await db
        .select()
        .from(buildings)
        .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)))
        .limit(1);

    if (!building) {
        await failRun(db, billingRunId, "Building not found or agency mismatch");
        return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    const utilities = await db
        .select()
        .from(buildingUtilities)
        .where(
            and(
                eq(buildingUtilities.buildingId, buildingId),
                eq(buildingUtilities.agencyId, agencyId),
                eq(buildingUtilities.isEnabled, true)
            )
        );

    // ── 5. Fetch all ACTIVE tenants in this building ───────────────────────
    const buildingTenants = await db
        .select({
            tenantId: tenants.id,
            unitId: tenants.unitId,
            fullName: tenants.fullName,
        })
        .from(tenants)
        .where(
            and(
                eq(tenants.buildingId, buildingId),
                eq(tenants.agencyId, agencyId),
                eq(tenants.status, "ACTIVE")
            )
        );

    // Update total tenant count
    await db
        .update(billingRuns)
        .set({ totalTenants: buildingTenants.length })
        .where(eq(billingRuns.id, billingRunId));

    // ── 6. Calculate previous month for arrears ──────────────────────────────
    const [year, month] = billingMonth.split("-").map(Number);
    const prevMonth = month === 1
        ? `${year - 1}-12`
        : `${year}-${String(month - 1).padStart(2, "0")}`;

    // ── 7. Bill each tenant (with idempotency) ─────────────────────────────
    let entriesInserted = 0;
    let entriesSkipped = 0;
    let processedTenants = 0;
    const errors: string[] = [];

    for (const tenant of buildingTenants) {
        try {
            // ── 7a. Get tenant's unit (for rent/deposit amounts) ───────────────
            const [unit] = await db
                .select({ rentAmount: units.rentAmount, depositAmount: units.depositAmount })
                .from(units)
                .where(and(eq(units.id, tenant.unitId), eq(units.agencyId, agencyId)))
                .limit(1);

            if (!unit) {
                errors.push(`Unit not found for tenant ${tenant.tenantId}`);
                continue;
            }

            // ── 7b. Calculate previous balance ─────────────────────────────────
            const [balanceResult] = await db
                .select({
                    totalCharged: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' AND ${tenantLedger.approvalStatus} = 'APPROVED' THEN ${tenantLedger.amount} ELSE 0 END), 0)`,
                    totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' AND ${tenantLedger.approvalStatus} = 'APPROVED' THEN ${tenantLedger.amount} ELSE 0 END), 0)`,
                })
                .from(tenantLedger)
                .where(
                    and(
                        eq(tenantLedger.tenantId, tenant.tenantId),
                        eq(tenantLedger.agencyId, agencyId)
                    )
                );

            const balance = Number(balanceResult?.totalCharged ?? 0) - Number(balanceResult?.totalPaid ?? 0);

            // ── 7c. Build ledger entries for this tenant ───────────────────────
            const entriesToInsert: Array<Omit<InsertTenantLedgerEntry, "id" | "createdAt">> = [];

            // Previous balance (if > 0)
            if (balance > 0) {
                entriesToInsert.push({
                    tenantId: tenant.tenantId,
                    buildingId,
                    agencyId,
                    type: "DEBIT",
                    category: "PREVIOUS_BALANCE",
                    amount: balance.toFixed(2),
                    billingMonth,
                    description: `Previous balance carried forward (${prevMonth})`,
                    method: "SYSTEM",
                    recordedBy: "SYSTEM_CRON",
                    approvalStatus: "APPROVED",
                });
            }

            // Current month rent
            entriesToInsert.push({
                tenantId: tenant.tenantId,
                buildingId,
                agencyId,
                type: "DEBIT",
                category: "RENT",
                amount: unit.rentAmount,
                billingMonth,
                description: `Rent for ${billingMonth}`,
                method: "SYSTEM",
                recordedBy: "SYSTEM_CRON",
                approvalStatus: "APPROVED",
            });

            // Fixed utilities
            for (const util of utilities) {
                const amount = util.defaultAmount;

                if (
                    util.rateType === "FIXED" &&
                    amount !== null &&
                    Number(amount) > 0
                ) {
                    entriesToInsert.push({
                        tenantId: tenant.tenantId,
                        buildingId,
                        agencyId,
                        type: "DEBIT",
                        category: util.name,
                        amount, // now known to be string
                        billingMonth,
                        description: `${util.name} for ${billingMonth}`,
                        method: "SYSTEM",
                        recordedBy: "SYSTEM_CRON",
                        approvalStatus: "APPROVED",
                    });
                }
            }

            // ── 7d. Insert with idempotency (skip on conflict) ─────────────────
            for (const entry of entriesToInsert) {
                try {
                    await db.insert(tenantLedger).values(entry as InsertTenantLedgerEntry);
                    entriesInserted++;
                } catch (err: any) {
                    // Check for unique constraint violation (double-bill prevention)
                    if (err.code === "23505" || err.message?.includes("unique constraint")) {
                        entriesSkipped++;
                    } else {
                        throw err; // Re-throw unexpected errors
                    }
                }
            }

            processedTenants++;

            // ── 7e. Update progress every 10 tenants ───────────────────────────
            if (processedTenants % 10 === 0) {
                await db
                    .update(billingRuns)
                    .set({
                        processedTenants,
                        entriesInserted,
                        entriesSkipped,
                    })
                    .where(eq(billingRuns.id, billingRunId));
            }
        } catch (tenantErr: any) {
            errors.push(`Tenant ${tenant.tenantId}: ${tenantErr.message}`);
            // Continue with next tenant — don't fail the whole batch
        }
    }

    // ── 8. Mark billing run as COMPLETE or FAILED ──────────────────────────
    const durationMs = Date.now() - startTime;
    const hasErrors = errors.length > 0;

    await db
        .update(billingRuns)
        .set({
            status: hasErrors ? "FAILED" : "COMPLETE",
            processedTenants,
            entriesInserted,
            entriesSkipped,
            errorMessage: hasErrors ? errors.join("; ").slice(0, 1000) : null,
            errorDetails: hasErrors ? { errors, durationMs } : null,
            completedAt: new Date(),
        })
        .where(eq(billingRuns.id, billingRunId));

    // ── 9. Return result ───────────────────────────────────────────────────
    return NextResponse.json({
        success: !hasErrors,
        billingRunId,
        buildingId,
        billingMonth,
        processedTenants,
        entriesInserted,
        entriesSkipped,
        errors: errors.length > 0 ? errors : undefined,
        durationMs,
    });
}

// ── Helper: mark run as failed ────────────────────────────────────────────
async function failRun(
    db: ReturnType<typeof getDb>,
    billingRunId: string,
    message: string
) {
    await db
        .update(billingRuns)
        .set({
            status: "FAILED",
            errorMessage: message,
            completedAt: new Date(),
        })
        .where(eq(billingRuns.id, billingRunId));
}

// ── Config: extend timeout for large buildings ───────────────────────────
export const maxDuration = 300; // 5 minutes per building batch