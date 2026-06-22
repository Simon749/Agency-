// app/api/cron/subscription-reminders/route.ts
// Daily cron — runs at 9:00 AM EAT.
// 1. Sends 7-day and 1-day subscription due reminders
// 2. Marks overdue subscriptions
// 3. Suspends agencies past grace period
// 4. Sends trial ending reminders
// Schedule: "0 9 * * *"

import { NextRequest, NextResponse } from "next/server";
import {
  sendSubscriptionDue7DayReminders,
  sendSubscriptionDue1DayReminders,
  sendTrialEndingReminders,
  processOverdueSubscriptions,
} from "@/lib/sms/subscription-triggers";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error("[CRON] CRON_SECRET not set");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  const token = authHeader?.replace("Bearer ", "").trim();
  if (token !== expectedSecret) {
    console.warn("[CRON] Unauthorized subscription-reminders attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const targetDate = url.searchParams.get("date") ?? undefined;

  try {
    console.log(`[CRON] Subscription reminders started at ${new Date().toISOString()}`);

    const [due7Day, due1Day, trialEnding, overdue] = await Promise.all([
      sendSubscriptionDue7DayReminders(targetDate),
      sendSubscriptionDue1DayReminders(targetDate),
      sendTrialEndingReminders(targetDate),
      processOverdueSubscriptions(targetDate),
    ]);

    console.log("[CRON] Subscription reminders complete:", {
      due7Day,
      due1Day,
      trialEnding,
      overdue,
    });

    return NextResponse.json({
      success: true,
      message: "Subscription reminders processed",
      results: {
        due7Day,
        due1Day,
        trialEnding,
        overdue,
      },
    });
  } catch (err) {
    console.error("[CRON] Subscription reminders failed:", err);
    return NextResponse.json(
      {
        error: "Subscription reminders failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}