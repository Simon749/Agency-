// app/api/cron/rent-reminders/route.ts
// Daily cron — runs at 8:00 AM EAT.
// Sends SMS to tenants whose rent is due in 7 days.
// Schedule: "0 8 * * *"

import { NextRequest, NextResponse } from "next/server";
import { sendRentDueReminders } from "@/lib/sms/triggers";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error("[CRON] CRON_SECRET not set");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  const token = authHeader?.replace("Bearer ", "").trim();
  if (token !== expectedSecret) {
    console.warn("[CRON] Unauthorized rent-reminders attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: override "today" for testing
  const url = new URL(req.url);
  const targetDate = url.searchParams.get("date") ?? undefined;

  try {
    console.log(`[CRON] Rent reminders started at ${new Date().toISOString()}`);
    const result = await sendRentDueReminders(targetDate);
    console.log("[CRON] Rent reminders complete:", result);

    return NextResponse.json({
      success: true,
      message: "Rent due reminders dispatched",
      result,
    });
  } catch (err) {
    console.error("[CRON] Rent reminders failed:", err);
    return NextResponse.json(
      { error: "Rent reminders failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}