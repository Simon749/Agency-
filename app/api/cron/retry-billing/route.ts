// app/api/cron/retry-billing/route.ts
// PHASE F: Manual retry endpoint for failed billing runs.
// Can be called by Super Admin dashboard or via cron for auto-retry.
//
// Usage:
//   GET /api/cron/retry-billing?runId=<billingRunId>
//   Headers: Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from "next/server";
import { eq, and, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { billingRuns } from "@/db/schema";
import { qstash } from "@/lib/qstash";

export async function GET(req: NextRequest) {
  // ── Security ──
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");

  // ── Single run retry ──
  if (runId) {
    const [run] = await db
      .select()
      .from(billingRuns)
      .where(eq(billingRuns.id, runId))
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: "Billing run not found" }, { status: 404 });
    }

    if (run.status === "COMPLETE") {
      return NextResponse.json({
        success: true,
        message: "Billing run already completed",
        runId,
        status: "COMPLETE",
      });
    }

    if (run.attemptCount >= run.maxAttempts) {
      return NextResponse.json({
        error: "Max retry attempts exceeded",
        runId,
        attemptCount: run.attemptCount,
        maxAttempts: run.maxAttempts,
      }, { status: 400 });
    }

    // Re-enqueue the job
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-domain.vercel.app";
    const result = await qstash.publishJSON({
      url: `${appUrl}/api/jobs/bill-building`,
      body: {
        billingRunId: run.id,
        buildingId: run.buildingId,
        agencyId: run.agencyId,
        billingMonth: run.billingMonth,
      },
      retries: 3,
      deduplicationId: `retry-${run.buildingId}-${run.billingMonth}-${run.attemptCount + 1}`,
    });

    // Update status to RETRYING
    await db
      .update(billingRuns)
      .set({ status: "RETRYING" })
      .where(eq(billingRuns.id, run.id));

    return NextResponse.json({
      success: true,
      message: "Retry enqueued",
      runId,
      qstashMessageId: result.messageId,
    });
  }

  // ── Auto-retry all FAILED runs under maxAttempts ──
  const failedRuns = await db
    .select()
    .from(billingRuns)
    .where(
      and(
        eq(billingRuns.status, "FAILED"),
        lte(billingRuns.attemptCount, billingRuns.maxAttempts)
      )
    );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-domain.vercel.app";
  const retried: string[] = [];
  const errors: string[] = [];

  for (const run of failedRuns) {
    try {
      await qstash.publishJSON({
        url: `${appUrl}/api/jobs/bill-building`,
        body: {
          billingRunId: run.id,
          buildingId: run.buildingId,
          agencyId: run.agencyId,
          billingMonth: run.billingMonth,
        },
        retries: 3,
        deduplicationId: `retry-${run.buildingId}-${run.billingMonth}-${run.attemptCount + 1}`,
      });

      await db
        .update(billingRuns)
        .set({ status: "RETRYING" })
        .where(eq(billingRuns.id, run.id));

      retried.push(run.id);
    } catch (err: any) {
      errors.push(`${run.id}: ${err.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    message: `Retried ${retried.length} failed runs`,
    retried,
    errors: errors.length > 0 ? errors : undefined,
  });
}

export const maxDuration = 60;