// app/api/cron/daily-orchestrator/route.ts
import { qstash } from "@/lib/qstash/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const today = new Date().toISOString().slice(0, 10);

  // Schedule all daily jobs with QStash delays
  const jobs = [
    // 8:00 AM — Rent reminders
    { url: `${baseUrl}/api/cron/rent-reminders`, delay: 6 * 60 * 60 },     // 6h after 2am
    // 9:00 AM — Overdue reminders
    { url: `${baseUrl}/api/cron/overdue-reminders`, delay: 7 * 60 * 60 },
    // 9:00 AM — Subscription reminders
    { url: `${baseUrl}/api/cron/subscription-reminders`, delay: 7 * 60 * 60 },
    // 9:00 AM — Key rotation alerts
    { url: `${baseUrl}/api/cron/key-rotation-alert`, delay: 7 * 60 * 60 },
    // 2:00 AM — Ledger reconciliation
    { url: `${baseUrl}/api/cron/ledger-reconciliation`, delay: 0 },
    // 3:00 AM — Reconciliation
    { url: `${baseUrl}/api/cron/reconciliation`, delay: 1 * 60 * 60 },
    // 3:00 AM — Backup
    { url: `${baseUrl}/api/cron/backup-critical-data`, delay: 1 * 60 * 60 },
    // 3:00 AM — Audit export
    { url: `${baseUrl}/api/cron/daily-audit-export`, delay: 1 * 60 * 60 },
  ];

  const queued = [];
  for (const job of jobs) {
    const { messageId } = await qstash.publishJSON({
      url: job.url,
      method: "GET",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      delay: job.delay,
      retries: 3,
    });
    queued.push({ ...job, messageId });
  }

  return NextResponse.json({ message: "Daily jobs queued", queued });
}