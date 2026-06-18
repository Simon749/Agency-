// app/api/cron/lease-renewal-reminders/route.ts
// Monthly cron — runs on the 1st of each month at 7:00 AM EAT.
// Finds leases expiring in ~60 days and sends renewal SMS.
// Schedule: "0 7 1 * *"

import { NextRequest, NextResponse } from "next/server";
import { sendLeaseRenewalReminders } from "@/lib/sms/triggers";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error("[CRON] CRON_SECRET not set");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  const token = authHeader?.replace("Bearer ", "").trim();
  if (token !== expectedSecret) {
    console.warn("[CRON] Unauthorized lease-renewal attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const targetDate = url.searchParams.get("date") ?? undefined;

  try {
    console.log(`[CRON] Lease renewal reminders started at ${new Date().toISOString()}`);
    const result = await sendLeaseRenewalReminders(targetDate);
    console.log("[CRON] Lease renewal reminders complete:", result);

    return NextResponse.json({
      success: true,
      message: "Lease renewal reminders dispatched",
      result,
    });
  } catch (err) {
    console.error("[CRON] Lease renewal reminders failed:", err);
    return NextResponse.json(
      { error: "Lease renewal reminders failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}