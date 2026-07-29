// lib/sms/triggers.ts
// SMS trigger orchestration — fetches data, formats messages, routes through
// dispatchNotification (agency preference gate), which calls sendSms.
//
// Preference-gated (respect /admin/settings/notifications toggles):
//   payment received, rent reminder, overdue, lease renewal,
//   complaint filed, complaint resolved, invite sent.
//
// NOT gated (no toggle exists — financial/critical, always sent):
//   payment failed, refund confirmation.
//   If you want these gated too, add notifyPaymentFailed / notifyRefund
//   columns to notification_preferences and switch these two to dispatchNotification.

import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  tenants,
  buildings,
  units,
  leases,
  tenantLedger,
  complaints,
  staff,
} from "@/db/schema";
import { sendSms } from "./sendSms";
import { dispatchNotification, type NotificationType } from "@/lib/notifications/channel-router";
import * as templates from "./templates";

// ── Helper: ungated direct send (payment failed, refunds) ─────────────────

async function safeSend(phone: string | null, message: string): Promise<boolean> {
  if (!phone) {
    console.warn("[SMS] No phone number — skipping send");
    return false;
  }
  const result = await sendSms(phone, message);
  if (!result.success) {
    console.error(`[SMS] Failed to send to ${phone}:`, result.error);
  }
  return result.success;
}

// ── Helper: preference-gated send via channel-router ───────────────────────

async function routedSend(params: {
  userId: string | null;
  agencyId: string;
  phone: string | null;
  message: string;
  type: NotificationType;
}): Promise<{ success: boolean; skipped: boolean }> {
  if (!params.phone) {
    console.warn("[SMS] No phone number — skipping send");
    return { success: false, skipped: true };
  }

  const result = await dispatchNotification({
    userId: params.userId ?? "", // clerkUserId when known; router doesn't use it today
    agencyId: params.agencyId,
    phone: params.phone,
    message: params.message,
    type: params.type,
  });

  if (result.skipped) {
    console.log(`[SMS] Skipped (${params.type}): ${result.reason}`);
    return { success: false, skipped: true };
  }
  if (!result.success) {
    console.error(`[SMS] Failed to send to ${params.phone}:`, result.error);
  }
  return { success: result.success, skipped: false };
}

// ── 1. Payment Received (from Daraja callback) — GATED ─────────────────────

export async function sendPaymentReceivedSms(
  tenantId: string,
  amount: number | string,
  receipt: string,
  billingMonth?: string
): Promise<boolean> {
  const db = getDb();
  const [tenant] = await db
    .select({
      fullName: tenants.fullName,
      phone: tenants.phone,
      buildingId: tenants.buildingId,
      agencyId: tenants.agencyId,
      clerkUserId: tenants.clerkUserId,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  if (!tenant) return false;

  let buildingName: string | undefined;
  if (tenant.buildingId) {
    const [b] = await db
      .select({ name: buildings.name })
      .from(buildings)
      .where(eq(buildings.id, tenant.buildingId));
    buildingName = b?.name;
  }

  const month = billingMonth ?? new Date().toISOString().slice(0, 7);
  const message = templates.paymentReceivedSms({
    tenantName: tenant.fullName,
    amount,
    month,
    receipt,
    buildingName,
  });

  const { success } = await routedSend({
    userId: tenant.clerkUserId,
    agencyId: tenant.agencyId,
    phone: tenant.phone,
    message,
    type: "PAYMENT",
  });
  return success;
}

// ── 2. Payment Failed (from Daraja callback) — NOT GATED ───────────────────

export async function sendPaymentFailedSms(
  tenantId: string,
  amount: number | string,
  reason: string
): Promise<boolean> {
  const db = getDb();
  const [tenant] = await db
    .select({ fullName: tenants.fullName, phone: tenants.phone })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  if (!tenant) return false;

  const message = templates.paymentFailedSms({
    tenantName: tenant.fullName,
    amount,
    reason,
  });

  return safeSend(tenant.phone, message);
}

// ── 3. Rent Due in 7 Days (daily cron) — GATED ──────────────────────────────

export async function sendRentDueReminders(targetDate?: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const db = getDb();
  const today = targetDate ? new Date(targetDate) : new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 7);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  const rows = await db
    .select({
      tenantId: tenants.id,
      fullName: tenants.fullName,
      phone: tenants.phone,
      agencyId: tenants.agencyId,
      clerkUserId: tenants.clerkUserId,
      buildingName: buildings.name,
      unitNumber: units.unitNumber,
      rentAmount: units.rentAmount,
    })
    .from(tenants)
    .innerJoin(buildings, eq(tenants.buildingId, buildings.id))
    .innerJoin(units, eq(tenants.unitId, units.id))
    .where(
      and(
        eq(tenants.status, "ACTIVE"),
        eq(tenants.inviteStatus, "ACCEPTED")
      )
    );

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const message = templates.rentDueReminderSms({
      tenantName: row.fullName,
      amount: row.rentAmount,
      buildingName: row.buildingName,
      unitNumber: row.unitNumber,
      dueDate: dueDateStr,
    });

    const result = await routedSend({
      userId: row.clerkUserId,
      agencyId: row.agencyId,
      phone: row.phone,
      message,
      type: "REMINDER",
    });

    if (result.skipped) skipped++;
    else if (result.success) sent++;
    else failed++;
  }

  console.log(`[SMS] Rent due reminders: ${sent} sent, ${failed} failed, ${skipped} skipped (due: ${dueDateStr})`);
  return { sent, failed, skipped };
}

// ── 4. Rent Overdue by 3+ Days (daily cron) — GATED ─────────────────────────

export async function sendOverdueReminders(targetDate?: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const db = getDb();
  const today = targetDate ? new Date(targetDate) : new Date();

  const balanceRows = await db
    .select({
      tenantId: tenants.id,
      fullName: tenants.fullName,
      phone: tenants.phone,
      agencyId: tenants.agencyId,
      clerkUserId: tenants.clerkUserId,
      buildingName: buildings.name,
      unitNumber: units.unitNumber,
      totalDebit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(tenants)
    .innerJoin(buildings, eq(tenants.buildingId, buildings.id))
    .innerJoin(units, eq(tenants.unitId, units.id))
    .leftJoin(tenantLedger, eq(tenants.id, tenantLedger.tenantId))
    .where(
      and(
        eq(tenants.status, "ACTIVE"),
        eq(tenants.inviteStatus, "ACCEPTED")
      )
    )
    .groupBy(
      tenants.id,
      tenants.fullName,
      tenants.phone,
      tenants.agencyId,
      tenants.clerkUserId,
      buildings.name,
      units.unitNumber
    );

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of balanceRows) {
    const balance = Number(row.totalDebit) - Number(row.totalCredit);
    if (balance <= 0) {
      skipped++;
      continue;
    }

    const daysOverdue = Math.max(3, today.getDate() - 3);

    const message = templates.rentOverdueSms({
      tenantName: row.fullName,
      amount: balance.toFixed(2),
      daysOverdue,
      buildingName: row.buildingName,
      unitNumber: row.unitNumber,
    });

    const result = await routedSend({
      userId: row.clerkUserId,
      agencyId: row.agencyId,
      phone: row.phone,
      message,
      type: "OVERDUE",
    });

    if (result.skipped) skipped++;
    else if (result.success) sent++;
    else failed++;
  }

  console.log(`[SMS] Overdue reminders: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped };
}

// ── 5. Lease Renewal — 60 Days Out (monthly cron) — GATED ──────────────────

export async function sendLeaseRenewalReminders(targetDate?: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const db = getDb();
  const today = targetDate ? new Date(targetDate) : new Date();
  const sixtyDaysOut = new Date(today);
  sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);
  const targetDateStr = sixtyDaysOut.toISOString().slice(0, 10);

  const rows = await db
    .select({
      tenantId: tenants.id,
      fullName: tenants.fullName,
      phone: tenants.phone,
      agencyId: tenants.agencyId,
      clerkUserId: tenants.clerkUserId,
      buildingName: buildings.name,
      unitNumber: units.unitNumber,
      leaseId: leases.id,
      endDate: leases.endDate,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .innerJoin(buildings, eq(tenants.buildingId, buildings.id))
    .innerJoin(units, eq(tenants.unitId, units.id))
    .where(
      and(
        eq(leases.status, "ACTIVE"),
        eq(tenants.status, "ACTIVE"),
        lte(leases.endDate, targetDateStr),
        gte(leases.endDate, today.toISOString().slice(0, 10)),
        sql`${leases.renewalReminderSentAt} IS NULL`
      )
    );

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const message = templates.leaseRenewalReminderSms({
      tenantName: row.fullName,
      expiryDate: row.endDate,
      buildingName: row.buildingName,
      unitNumber: row.unitNumber,
    });

    const result = await routedSend({
      userId: row.clerkUserId,
      agencyId: row.agencyId,
      phone: row.phone,
      message,
      type: "LEASE",
    });

    if (result.skipped) {
      skipped++;
    } else if (result.success) {
      sent++;
      await db
        .update(leases)
        .set({ renewalReminderSentAt: new Date() })
        .where(eq(leases.id, row.leaseId));
    } else {
      failed++;
    }
  }

  console.log(`[SMS] Lease renewal reminders: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped };
}

// ── 6. New Complaint Filed → Notify Manager — GATED ─────────────────────────

export async function sendNewComplaintManagerSms(complaintId: string): Promise<boolean> {
  const db = getDb();

  const [complaint] = await db
    .select({
      tenantId: complaints.tenantId,
      agencyId: complaints.agencyId,
      title: complaints.title,
      priority: complaints.priority,
      assignedTo: complaints.assignedTo,
    })
    .from(complaints)
    .where(eq(complaints.id, complaintId));

  if (!complaint?.assignedTo) {
    console.warn(`[SMS] Complaint ${complaintId} has no assigned manager — skipping`);
    return false;
  }

  const [tenant] = await db
    .select({
      fullName: tenants.fullName,
      buildingId: tenants.buildingId,
      unitId: tenants.unitId,
    })
    .from(tenants)
    .where(eq(tenants.id, complaint.tenantId));

  if (!tenant) return false;

  const [manager] = await db
    .select({ fullName: staff.fullName, phone: staff.phone })
    .from(staff)
    .where(eq(staff.clerkUserId, complaint.assignedTo));

  if (!manager?.phone) {
    console.warn(`[SMS] No phone on file for manager ${complaint.assignedTo}`);
    return false;
  }

  const [unit] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, tenant.unitId));

  const [building] = await db
    .select({ name: buildings.name })
    .from(buildings)
    .where(eq(buildings.id, tenant.buildingId));

  const message = templates.newComplaintManagerSms({
    managerName: manager.fullName,
    tenantName: tenant.fullName,
    unitNumber: unit?.unitNumber ?? "unknown unit",
    buildingName: building?.name ?? "the building",
    title: complaint.title,
    priority: complaint.priority,
  });

  const { success } = await routedSend({
    userId: complaint.assignedTo,
    agencyId: complaint.agencyId,
    phone: manager.phone,
    message,
    type: "COMPLAINT_FILED",
  });
  return success;
}

// ── 7. Complaint Resolved → Notify Tenant — GATED ───────────────────────────

export async function sendComplaintResolvedSms(complaintId: string): Promise<boolean> {
  const db = getDb();

  const [complaint] = await db
    .select({
      tenantId: complaints.tenantId,
      agencyId: complaints.agencyId,
      title: complaints.title,
    })
    .from(complaints)
    .where(eq(complaints.id, complaintId));

  if (!complaint) return false;

  const [tenant] = await db
    .select({
      fullName: tenants.fullName,
      phone: tenants.phone,
      buildingId: tenants.buildingId,
      unitId: tenants.unitId,
      clerkUserId: tenants.clerkUserId,
    })
    .from(tenants)
    .where(eq(tenants.id, complaint.tenantId));

  if (!tenant?.phone) return false;

  const [building] = await db
    .select({ name: buildings.name })
    .from(buildings)
    .where(eq(buildings.id, tenant.buildingId));

  const [unit] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, tenant.unitId));

  const message = templates.complaintResolvedSms({
    tenantName: tenant.fullName,
    title: complaint.title,
    buildingName: building?.name ?? "your building",
    unitNumber: unit?.unitNumber ?? "your unit",
  });

  const { success } = await routedSend({
    userId: tenant.clerkUserId,
    agencyId: complaint.agencyId,
    phone: tenant.phone,
    message,
    type: "COMPLAINT_RESOLVED",
  });
  return success;
}

// ── 8. Tenant Invite Sent — GATED ───────────────────────────────────────────

export async function sendTenantInviteSms(
  tenantId: string,
  inviteLink: string,
  agencyName: string
): Promise<boolean> {
  const db = getDb();
  const [tenant] = await db
    .select({
      fullName: tenants.fullName,
      phone: tenants.phone,
      agencyId: tenants.agencyId,
      clerkUserId: tenants.clerkUserId,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  if (!tenant?.phone) return false;

  const message = templates.tenantInviteSms({
    tenantName: tenant.fullName,
    agencyName,
    inviteLink,
  });

  const { success } = await routedSend({
    userId: tenant.clerkUserId,
    agencyId: tenant.agencyId,
    phone: tenant.phone,
    message,
    type: "INVITE",
  });
  return success;
}

// ── 9. Refund Confirmation — NOT GATED ──────────────────────────────────────

export async function sendRefundConfirmationSms(
  tenantId: string,
  amount: number | string,
  reason?: string
): Promise<boolean> {
  const db = getDb();
  const [tenant] = await db
    .select({
      fullName: tenants.fullName,
      phone: tenants.phone,
      buildingId: tenants.buildingId,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  if (!tenant) return false;

  let buildingName: string | undefined;
  if (tenant.buildingId) {
    const [b] = await db
      .select({ name: buildings.name })
      .from(buildings)
      .where(eq(buildings.id, tenant.buildingId));
    buildingName = b?.name;
  }

  const message = templates.refundConfirmationSms({
    tenantName: tenant.fullName,
    amount,
    reason,
    buildingName,
  });

  return safeSend(tenant.phone, message);
}