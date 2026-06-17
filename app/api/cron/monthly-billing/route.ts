// app/api/cron/monthly-billing/route.ts
// Vercel Cron entry point — secured with CRON_SECRET.
// Schedule: "0 6 1 * *" (6:00 AM EAT on the 1st of every month)

import { NextRequest, NextResponse } from "next/server";
import { runMonthlyBilling } from "@/lib/cron/monthlyBilling";

export async function GET(req: NextRequest) {
  // ── Security: verify CRON_SECRET ──
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error("CRON_SECRET is not set in environment variables");
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 500 }
    );
  }

  const token = authHeader?.replace("Bearer ", "").trim();
  if (token !== expectedSecret) {
    console.warn("Unauthorized cron attempt — invalid or missing CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Optional: allow manual month override for testing ──
  const url = new URL(req.url);
  const targetMonth = url.searchParams.get("month") ?? undefined;

  try {
    console.log(`[CRON] Monthly billing started at ${new Date().toISOString()}`);
    const summary = await runMonthlyBilling(targetMonth);
    console.log(`[CRON] Monthly billing completed:`, summary);

    return NextResponse.json({
      success: true,
      message: `Billing complete for ${summary.billingMonth}`,
      summary: {
        totalTenants: summary.totalTenants,
        entriesInserted: summary.totalEntriesInserted,
        amountBilled: summary.totalAmountBilled,
        skipped: summary.skipped,
        errors: summary.errors,
      },
    });
  } catch (err) {
    console.error("[CRON] Monthly billing failed:", err);
    return NextResponse.json(
      { error: "Billing job failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}