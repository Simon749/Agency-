// lib/sms/triggers.ts
// SMS trigger orchestration — fetches data, formats messages, sends SMS.
// All functions are safe to call from Server Actions, API routes, and cron jobs.
// They gracefully degrade if AT credentials are missing or tenant has no phone.

import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  tenants,
  buildings,
  units,
  leases,
  tenantLedger,
  pendingTransactions,
  complaints,
} from "@/db/schema";
import { sendSms } from "./sendSms";
import * as templates from "./templates";

// ── Helper: safely send SMS and log result ─────────────────────────────────

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

// ── 1. Payment Received (from Daraja callback) ─────────────────────────────

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

  return safeSend(tenant.phone, message);
}

// ── 2. Payment Failed (from Daraja callback) ─────────────────────────────────

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

// ── 3. Rent Due in 7 Days (daily cron) ─────────────────────────────────────

export async function sendRentDueReminders(targetDate?: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const db = getDb();
  const today = targetDate ? new Date(targetDate) : new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 7);
  const dueDateStr = dueDate.toISOString().slice(0, 10); // YYYY-MM-DD

  // Find tenants whose lease start day is 7 days from now (simplified: bill on 1st)
  // For PropFlow, rent is typically due on the 1st of each month.
  // We send reminders on the 24th of the previous month.
  const isFirstOfMonth = today.getDate() === 1;
  const billingMonth = today.toISOString().slice(0, 7);

  // Fetch active tenants with their building + unit + current rent
  const rows = await db
    .select({
      tenantId: tenants.id,
      fullName: tenants.fullName,
      phone: tenants.phone,
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
    if (!row.phone) {
      skipped++;
      continue;
    }

    const message = templates.rentDueReminderSms({
      tenantName: row.fullName,
      amount: row.rentAmount,
      buildingName: row.buildingName,
      unitNumber: row.unitNumber,
      dueDate: dueDateStr,
    });

    const ok = await safeSend(row.phone, message);
    ok ? sent++ : failed++;
  }

  console.log(`[SMS] Rent due reminders: ${sent} sent, ${failed} failed, ${skipped} skipped (due: ${dueDateStr})`);
  return { sent, failed, skipped };
}

// ── 4. Rent Overdue by 3+ Days (daily cron) ─────────────────────────────────

export async function sendOverdueReminders(targetDate?: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const db = getDb();
  const today = targetDate ? new Date(targetDate) : new Date();
  const billingMonth = today.toISOString().slice(0, 7);

  // Find all active tenants with a positive balance (owe money)
  // We calculate balance per tenant by summing debits - credits
  const balanceRows = await db
    .select({
      tenantId: tenants.id,
      fullName: tenants.fullName,
      phone: tenants.phone,
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
    .groupBy(tenants.id, tenants.fullName, tenants.phone, buildings.name, units.unitNumber);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of balanceRows) {
    const balance = Number(row.totalDebit) - Number(row.totalCredit);
    if (balance <= 0) {
      skipped++; // no arrears
      continue;
    }
    if (!row.phone) {
      skipped++;
      continue;
    }

    // Calculate days overdue (simplified: if balance > 0 and we're past the 3rd)
    const daysOverdue = Math.max(3, today.getDate() - 3);

    const message = templates.rentOverdueSms({
      tenantName: row.fullName,
      amount: balance.toFixed(2),
      daysOverdue,
      buildingName: row.buildingName,
      unitNumber: row.unitNumber,
    });

    const ok = await safeSend(row.phone, message);
    ok ? sent++ : failed++;
  }

  console.log(`[SMS] Overdue reminders: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped };
}

// ── 5. Lease Renewal — 60 Days Out (monthly cron) ────────────────────────────

export async function sendLeaseRenewalReminders(targetDate?: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const db = getDb();
  const today = targetDate ? new Date(targetDate) : new Date();
  const sixtyDaysOut = new Date(today);
  sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);
  const targetDateStr = sixtyDaysOut.toISOString().slice(0, 10); // YYYY-MM-DD

  // Find leases ending in ~60 days that haven't had a reminder sent yet
  const rows = await db
    .select({
      tenantId: tenants.id,
      fullName: tenants.fullName,
      phone: tenants.phone,
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
    if (!row.phone) {
      skipped++;
      continue;
    }

    const message = templates.leaseRenewalReminderSms({
      tenantName: row.fullName,
      expiryDate: row.endDate,
      buildingName: row.buildingName,
      unitNumber: row.unitNumber,
    });

    const ok = await safeSend(row.phone, message);
    if (ok) {
      sent++;
      // Mark reminder as sent so we don't spam
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

// ── 6. New Complaint Filed → Notify Manager ──────────────────────────────────

export async function sendNewComplaintManagerSms(
  complaintId: string
): Promise<boolean> {
  const db = getDb();

  // Fetch complaint + tenant + building + unit
  const [complaint] = await db
    .select({
      tenantId: complaints.tenantId,
      title: complaints.title,
      priority: complaints.priority,
      assignedTo: complaints.assignedTo,
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
    })
    .from(tenants)
    .where(eq(tenants.id, complaint.tenantId));

  if (!tenant) return false;

  const [building] = await db
    .select({ name: buildings.name })
    .from(buildings)
    .where(eq(buildings.id, tenant.buildingId));

  const [unit] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, tenant.unitId));

  // If assignedTo is set, try to get manager's phone from Clerk metadata
  // Otherwise, we can't send — the agency owner should configure a manager phone
  // For now, we log a warning. In production, store manager phone in a staff table.
  if (!complaint.assignedTo) {
    console.warn(`[SMS] Complaint ${complaintId} has no assigned manager — skipping manager SMS`);
    return false;
  }

  // TODO: Look up manager phone from a staff/roles table when you build one
  // For now, this function returns false and logs — you'll wire it to your staff table in Week 15
  console.warn(`[SMS] Manager lookup not yet implemented for clerkId ${complaint.assignedTo}`);
  return false;
}

// ── 7. Complaint Resolved → Notify Tenant ────────────────────────────────────

export async function sendComplaintResolvedSms(
  complaintId: string
): Promise<boolean> {
  const db = getDb();

  const [complaint] = await db
    .select({
      tenantId: complaints.tenantId,
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

  return safeSend(tenant.phone, message);
}

// ── 8. Tenant Invite Sent ────────────────────────────────────────────────────

export async function sendTenantInviteSms(
  tenantId: string,
  inviteLink: string,
  agencyName: string
): Promise<boolean> {
  const db = getDb();
  const [tenant] = await db
    .select({ fullName: tenants.fullName, phone: tenants.phone })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  if (!tenant?.phone) return false;

  const message = templates.tenantInviteSms({
    tenantName: tenant.fullName,
    agencyName,
    inviteLink,
  });

  return safeSend(tenant.phone, message);
}