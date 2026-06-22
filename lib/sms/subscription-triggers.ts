// lib/sms/subscription-triggers.ts
// SMS triggers for Super Admin subscription management.
// Called from cron jobs and server actions.

import { eq, and, lte, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agencies, agencySubscriptions } from "@/db/schema";
import { sendSms } from "./sendSms";
import * as templates from "./templates";

// ── Helper: safely send SMS and log ──────────────────────────────────────

async function safeSend(phone: string | null, message: string): Promise<boolean> {
  if (!phone) {
    console.warn("[SMS-SUB] No phone number — skipping");
    return false;
  }
  const result = await sendSms(phone, message);
  if (!result.success) {
    console.error(`[SMS-SUB] Failed to send to ${phone}:`, result.error);
  }
  return result.success;
}

// ── 1. Send 7-day subscription due reminders ───────────────────────────────

export async function sendSubscriptionDue7DayReminders(targetDate?: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const db = getDb();
  const today = targetDate ? new Date(targetDate) : new Date();
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const rows = await db
    .select({
      agencyId: agencies.id,
      agencyName: agencies.name,
      agencyPhone: agencies.phone,
      plan: agencySubscriptions.plan,
      amountKes: agencySubscriptions.amountKes,
      nextBillingDate: agencySubscriptions.nextBillingDate,
      mpesaPaybillNumber: agencySubscriptions.mpesaPaybillNumber,
      mpesaAccountNumber: agencySubscriptions.mpesaAccountNumber,
      reminder7DaySentAt: agencySubscriptions.reminder7DaySentAt,
    })
    .from(agencySubscriptions)
    .innerJoin(agencies, eq(agencySubscriptions.agencyId, agencies.id))
    .where(
      and(
        eq(agencySubscriptions.status, "ACTIVE"),
        sql`${agencies.deletedAt} IS NULL`,
        sql`${agencySubscriptions.nextBillingDate} <= ${sevenDaysFromNow.toISOString().slice(0, 10)}`,
        sql`${agencySubscriptions.nextBillingDate} > ${today.toISOString().slice(0, 10)}`,
        sql`${agencySubscriptions.reminder7DaySentAt} IS NULL`
      )
    );

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.nextBillingDate) { skipped++; continue; }

    const message = templates.subscriptionDue7DaySms({
      agencyName: row.agencyName,
      amount: row.amountKes,
      dueDate: row.nextBillingDate,
      paybillNumber: row.mpesaPaybillNumber || "522522",
      accountNumber: row.mpesaAccountNumber || "PENDING",
    });

    const ok = await safeSend(row.agencyPhone, message);
    if (ok) {
      sent++;
      await db
        .update(agencySubscriptions)
        .set({ reminder7DaySentAt: new Date() })
        .where(eq(agencySubscriptions.agencyId, row.agencyId));
    } else {
      failed++;
    }
  }

  console.log(`[SMS-SUB] 7-day reminders: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped };
}

// ── 2. Send 1-day subscription due reminders ─────────────────────────────

export async function sendSubscriptionDue1DayReminders(targetDate?: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const db = getDb();
  const today = targetDate ? new Date(targetDate) : new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const rows = await db
    .select({
      agencyId: agencies.id,
      agencyName: agencies.name,
      agencyPhone: agencies.phone,
      amountKes: agencySubscriptions.amountKes,
      nextBillingDate: agencySubscriptions.nextBillingDate,
      mpesaPaybillNumber: agencySubscriptions.mpesaPaybillNumber,
      mpesaAccountNumber: agencySubscriptions.mpesaAccountNumber,
      reminder1DaySentAt: agencySubscriptions.reminder1DaySentAt,
    })
    .from(agencySubscriptions)
    .innerJoin(agencies, eq(agencySubscriptions.agencyId, agencies.id))
    .where(
      and(
        eq(agencySubscriptions.status, "ACTIVE"),
        sql`${agencies.deletedAt} IS NULL`,
        sql`${agencySubscriptions.nextBillingDate} = ${tomorrow.toISOString().slice(0, 10)}`,
        sql`${agencySubscriptions.reminder1DaySentAt} IS NULL`
      )
    );

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const message = templates.subscriptionDue1DaySms({
      agencyName: row.agencyName,
      amount: row.amountKes,
      dueDate: row.nextBillingDate || tomorrow.toISOString().slice(0, 10),
      paybillNumber: row.mpesaPaybillNumber || "522522",
      accountNumber: row.mpesaAccountNumber || "PENDING",
    });

    const ok = await safeSend(row.agencyPhone, message);
    if (ok) {
      sent++;
      await db
        .update(agencySubscriptions)
        .set({ reminder1DaySentAt: new Date() })
        .where(eq(agencySubscriptions.agencyId, row.agencyId));
    } else {
      failed++;
    }
  }

  console.log(`[SMS-SUB] 1-day reminders: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped };
}

// ── 3. Send trial ending reminders (3 days before trial ends) ──────────────

export async function sendTrialEndingReminders(targetDate?: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const db = getDb();
  const today = targetDate ? new Date(targetDate) : new Date();
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const rows = await db
    .select({
      agencyId: agencies.id,
      agencyName: agencies.name,
      agencyPhone: agencies.phone,
      trialEndsAt: agencySubscriptions.trialEndsAt,
    })
    .from(agencySubscriptions)
    .innerJoin(agencies, eq(agencySubscriptions.agencyId, agencies.id))
    .where(
      and(
        eq(agencySubscriptions.plan, "TRIAL"),
        eq(agencySubscriptions.status, "ACTIVE"),
        sql`${agencies.deletedAt} IS NULL`,
        sql`${agencySubscriptions.trialEndsAt} <= ${threeDaysFromNow.toISOString().slice(0, 10)}`,
        sql`${agencySubscriptions.trialEndsAt} > ${today.toISOString().slice(0, 10)}`
      )
    );

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.trialEndsAt) { skipped++; continue; }

    const message = templates.trialEndingSms({
      agencyName: row.agencyName,
      trialEndsDate: row.trialEndsAt,
      starterAmount: 3500,
    });

    const ok = await safeSend(row.agencyPhone, message);
    ok ? sent++ : failed++;
  }

  console.log(`[SMS-SUB] Trial reminders: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped };
}

// ── 4. Mark overdue subscriptions + send notices ─────────────────────────

export async function processOverdueSubscriptions(targetDate?: string): Promise<{
  markedOverdue: number;
  suspended: number;
  smsSent: number;
  smsFailed: number;
}> {
  const db = getDb();
  const today = targetDate ? new Date(targetDate) : new Date();

  // 1. Mark subscriptions as OVERDUE where nextBillingDate < today
  const overdueRows = await db
    .select({
      agencyId: agencies.id,
      agencyName: agencies.name,
      agencyPhone: agencies.phone,
      amountKes: agencySubscriptions.amountKes,
      nextBillingDate: agencySubscriptions.nextBillingDate,
      gracePeriodDays: agencySubscriptions.gracePeriodDays,
      overdueSince: agencySubscriptions.overdueSince,
      overdueNoticeSentAt: agencySubscriptions.overdueNoticeSentAt,
    })
    .from(agencySubscriptions)
    .innerJoin(agencies, eq(agencySubscriptions.agencyId, agencies.id))
    .where(
      and(
        eq(agencySubscriptions.status, "ACTIVE"),
        sql`${agencies.deletedAt} IS NULL`,
        sql`${agencySubscriptions.nextBillingDate} < ${today.toISOString().slice(0, 10)}`,
        sql`${agencySubscriptions.plan} != 'TRIAL'`
      )
    );

  let markedOverdue = 0;
  let suspended = 0;
  let smsSent = 0;
  let smsFailed = 0;

  for (const row of overdueRows) {
    // Mark as overdue if not already
    if (!row.overdueSince) {
      await db
        .update(agencySubscriptions)
        .set({
          status: "OVERDUE",
          overdueSince: today,
        })
        .where(eq(agencySubscriptions.agencyId, row.agencyId));
      markedOverdue++;
    }

    // Send overdue notice (once)
    if (!row.overdueNoticeSentAt) {
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(row.nextBillingDate || today).getTime()) / (1000 * 60 * 60 * 24)
      );

      const message = templates.subscriptionOverdueSms({
        agencyName: row.agencyName,
        amount: row.amountKes,
        daysOverdue,
        gracePeriodDays: Number(row.gracePeriodDays ?? 7),
        paybillNumber: "522522",
        accountNumber: row.agencyId.slice(0, 8).toUpperCase(),
      });

      const ok = await safeSend(row.agencyPhone, message);
      if (ok) {
        smsSent++;
        await db
          .update(agencySubscriptions)
          .set({ overdueNoticeSentAt: new Date() })
          .where(eq(agencySubscriptions.agencyId, row.agencyId));
      } else {
        smsFailed++;
      }
    }

    // Check if grace period expired → suspend
    const graceDays = Number(row.gracePeriodDays ?? 7);
    const overdueSince = row.overdueSince ? new Date(row.overdueSince) : today;
    const daysSinceOverdue = Math.floor(
      (today.getTime() - overdueSince.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceOverdue >= graceDays) {
      // Suspend agency
      await db
        .update(agencies)
        .set({ isActive: false })
        .where(eq(agencies.id, row.agencyId));

      await db
        .update(agencySubscriptions)
        .set({ status: "SUSPENDED" })
        .where(eq(agencySubscriptions.agencyId, row.agencyId));

      // Send suspension notice
      const message = templates.subscriptionSuspendedSms({
        agencyName: row.agencyName,
        amount: row.amountKes,
        daysOverdue: daysSinceOverdue,
      });

      const ok = await safeSend(row.agencyPhone, message);
      if (ok) {
        await db
          .update(agencySubscriptions)
          .set({ suspensionNoticeSentAt: new Date() })
          .where(eq(agencySubscriptions.agencyId, row.agencyId));
      }

      suspended++;
    }
  }

  console.log(`[SMS-SUB] Overdue processing: ${markedOverdue} marked overdue, ${suspended} suspended, ${smsSent} SMS sent, ${smsFailed} failed`);
  return { markedOverdue, suspended, smsSent, smsFailed };
}

// ── 5. Send payment confirmation to agency ───────────────────────────────

export async function sendSubscriptionPaymentConfirmation(
  agencyId: string,
  amount: number | string,
  paidThroughDate: string,
  method: string
): Promise<boolean> {
  const db = getDb();

  const [agency] = await db
    .select({ name: agencies.name, phone: agencies.phone })
    .from(agencies)
    .where(eq(agencies.id, agencyId))
    .limit(1);

  if (!agency?.phone) return false;

  const message = templates.subscriptionPaymentConfirmedSms({
    agencyName: agency.name,
    amount,
    paidThroughDate,
    method,
  });

  return safeSend(agency.phone, message);
}