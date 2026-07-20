// app/api/cron/reconciliation/route.ts
// Phase D: Nightly Daraja ↔ Ledger reconciliation.
// Schedule: "0 3 * * *" (3:00 AM EAT daily) — after ledger-reconciliation at 2 AM.
// Secured with CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { runFullReconciliation } from "@/lib/reconciliation/matcher";
import { log, alert } from "@/lib/monitoring";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    log("error", "CRON_SECRET not configured", { service: "reconciliation-cron" });
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  const token = authHeader?.replace("Bearer ", "").trim();
  if (token !== expectedSecret) {
    log("warn", "Unauthorized reconciliation cron attempt", { service: "reconciliation-cron" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  log("info", "Nightly reconciliation started", { service: "reconciliation-cron" });

  try {
    const results = await runFullReconciliation();

    const totalMatched = results.reduce((sum, r) => sum + r.matched, 0);
    const totalDiscrepancies = results.reduce((sum, r) => sum + r.discrepancies, 0);
    const durationMs = Date.now() - startTime;

    log("info", "Nightly reconciliation complete", {
      service: "reconciliation-cron",
      metadata: {
        durationMs,
        buildingsChecked: results.length,
        totalMatched,
        totalDiscrepancies,
      },
    });

    if (totalDiscrepancies > 0) {
      alert("RECONCILIATION_DISCREPANCIES", 
        `${totalDiscrepancies} discrepancies found across ${results.length} buildings`, {
        metadata: { totalDiscrepancies, buildingsChecked: results.length },
      });
    }

    return NextResponse.json({
      success: true,
      durationMs,
      summary: {
        buildingsChecked: results.length,
        totalMatched,
        totalDiscrepancies,
      },
      results: results.map((r) => ({
        buildingId: r.buildingId,
        reportDate: r.reportDate,
        matched: r.matched,
        discrepancies: r.discrepancies,
      })),
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    log("error", "Nightly reconciliation failed", {
      service: "reconciliation-cron",
      error: err instanceof Error ? err : new Error(String(err)),
      metadata: { durationMs },
    });

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Reconciliation failed",
        durationMs,
      },
      { status: 500 }
    );
  }
}