// app/api/cron/daily-agent-report/route.ts
// Phase D: Daily per-agent cash entry report for agency owners.
// Schedule: "0 8 * * *" (8:00 AM EAT daily) — sent to agency owners.
// Secured with CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger, staff, agencies } from "@/db/schema";
import { log } from "@/lib/monitoring";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  const token = authHeader?.replace("Bearer ", "").trim();
  if (token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  try {
    const db = getDb();

    // Aggregate cash entries per agent per agency for today
    const report = await db
      .select({
        agentClerkId: tenantLedger.recordedBy,
        agencyId: tenantLedger.agencyId,
        totalCash: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.method} = 'CASH' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
        totalBank: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.method} = 'BANK_RECEIPT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
        entryCount: sql<number>`COUNT(*)`,
      })
      .from(tenantLedger)
      .where(
        and(
          gte(tenantLedger.createdAt, todayStart),
          eq(tenantLedger.type, "CREDIT"),
          sql`${tenantLedger.method} IN ('CASH', 'BANK_RECEIPT')`
        )
      )
      .groupBy(tenantLedger.recordedBy, tenantLedger.agencyId);

    // Enrich with agent names
    const enrichedReport = [];
    for (const row of report) {
      const [agent] = await db
        .select({ fullName: staff.fullName, role: staff.role })
        .from(staff)
        .where(eq(staff.clerkUserId, row.agentClerkId ?? ""))
        .limit(1);

      const [agency] = await db
        .select({ name: agencies.name })
        .from(agencies)
        .where(eq(agencies.id, row.agencyId))
        .limit(1);

      enrichedReport.push({
        agentName: agent?.fullName ?? row.agentClerkId ?? "Unknown",
        agentRole: agent?.role ?? "Unknown",
        agencyName: agency?.name ?? "Unknown",
        totalCash: Number(row.totalCash),
        totalBank: Number(row.totalBank),
        totalEntries: Number(row.entryCount),
      });
    }

    const durationMs = Date.now() - startTime;

    log("info", "Daily agent report generated", {
      service: "daily-agent-report",
      metadata: {
        durationMs,
        agentsReported: enrichedReport.length,
        date: todayStart.toISOString().split("T")[0],
      },
    });

    return NextResponse.json({
      success: true,
      date: todayStart.toISOString().split("T")[0],
      durationMs,
      report: enrichedReport,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Report generation failed",
      },
      { status: 500 }
    );
  }
}