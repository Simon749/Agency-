// app/api/cron/overdue-reminders/route.ts
// Daily cron — runs at 9:00 AM EAT.
// Sends SMS to tenants with outstanding balance > 0 (3+ days past due).
// Schedule: "0 9 * * *"

import { NextRequest, NextResponse } from "next/server";
import { sendOverdueReminders } from "@/lib/sms/triggers";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error("[CRON] CRON_SECRET not set");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  const token = authHeader?.replace("Bearer ", "").trim();
  if (token !== expectedSecret) {
    console.warn("[CRON] Unauthorized overdue-reminders attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const targetDate = url.searchParams.get("date") ?? undefined;

  try {
    console.log(`[CRON] Overdue reminders started at ${new Date().toISOString()}`);
    const result = await sendOverdueReminders(targetDate);
    console.log("[CRON] Overdue reminders complete:", result);

    return NextResponse.json({
      success: true,
      message: "Overdue reminders dispatched",
      result,
    });
  } catch (err) {
    console.error("[CRON] Overdue reminders failed:", err);
    return NextResponse.json(
      { error: "Overdue reminders failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}