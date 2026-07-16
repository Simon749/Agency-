// lib/audit/logger.ts
// Phase B — Core audit logging function.
// Call this from EVERY Server Action that mutates protected data.
//
// Usage:
//   import { logAuditEvent } from "@/lib/audit/logger";
//   await logAuditEvent({
//     action: "RENT_AMOUNT_EDIT",
//     targetTable: "leases",
//     targetId: leaseId,
//     beforeValue: oldLease,
//     afterValue: newLease,
//   });

"use server";

import { getDb } from "@/lib/db";
import { auditLog } from "@/db/schema";
import { getSessionMeta } from "@/lib/auth/getRole";
import { headers } from "next/headers";
import type { InsertAuditLogEntry } from "@/db/schema";
import type { AppRole } from "@/lib/auth/getRole";

// ── Action type union for compile-time safety ─────────────────────────────
export type AuditAction =
  | "ROLE_CHANGE"
  | "DARAJA_CREDENTIAL_UPDATE"
  | "RENT_AMOUNT_EDIT"
  | "DEPOSIT_AMOUNT_EDIT"
  | "KILL_SWITCH_TOGGLE"
  | "NATIONAL_ID_ACCESS"
  | "TENANT_REMOVE"
  | "STAFF_REMOVE"
  | "MANUAL_LEDGER_ENTRY"
  | "LEDGER_REVERSAL"
  | "STAFF_INVITE"
  | "TENANT_INVITE"
  | "TENANT_VACATE"
  | "COMPLAINT_ASSIGN"
  | "UTILITY_RATE_CHANGE"
  | "BUILDING_CREATE"
  | "BUILDING_DELETE"
  | "UNIT_CREATE"
  | "UNIT_DELETE"
  | "LEASE_CREATE"
  | "LEASE_UPDATE"
  | "LEASE_TERMINATE"
  | "METER_READING_CREATE"
  | "PAYMENT_INITIATED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "SMS_SENT"
  | "NOTIFICATION_SENT"
  | "AGENCY_CREATED"
  | "AGENCY_UPDATED"
  | "AGENCY_SUSPENDED"
  | "AGENCY_REACTIVATED";

export interface LogAuditEventInput {
  action: AuditAction;
  targetTable: string;
  targetId: string;
  agencyId?: string | null; // override if needed; defaults from session
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  // Optionally pass actor info if calling from a webhook (no Clerk session)
  actorClerkId?: string;
  actorRole?: AppRole;
}

/**
 * Logs an audit event. Safe to call — never throws (logs error internally).
 * Call this AFTER the DB mutation succeeds, so beforeValue/afterValue are accurate.
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  try {
    let actorClerkId = input.actorClerkId;
    let actorRole = input.actorRole;
    let agencyId = input.agencyId ?? null;

    // If no explicit actor, pull from Clerk session
    if (!actorClerkId || !actorRole) {
      try {
        const session = await getSessionMeta();
        actorClerkId = session.userId;
        actorRole = session.role ?? "SUPER_ADMIN"; // fallback for edge cases
        if (!agencyId && session.agencyId) {
          agencyId = session.agencyId;
        }
      } catch {
        // No session and no explicit actor — skip (webhooks should pass explicit)
        console.warn("[AUDIT] No session and no explicit actor. Skipping audit log.", {
          action: input.action,
          targetTable: input.targetTable,
          targetId: input.targetId,
        });
        return;
      }
    }

    // Capture request context
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? "unknown";
    const userAgent = headersList.get("user-agent") ?? "unknown";

    const db = getDb();
    await db.insert(auditLog).values({
      actorClerkId,
      actorRole,
      agencyId,
      action: input.action,
      targetTable: input.targetTable,
      targetId: input.targetId,
      beforeValue: input.beforeValue ?? null,
      afterValue: input.afterValue ?? null,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    // NEVER let audit logging break the main flow
    console.error("[AUDIT] Failed to write audit log:", err);
    console.error("[AUDIT] Event that failed:", JSON.stringify(input, null, 2));
  }
}

/**
 * Convenience wrapper for logging from webhooks (no Clerk session).
 * Pass explicit actor info. Use "SYSTEM" as actorClerkId for automated jobs.
 */
export async function logSystemEvent(input: Omit<LogAuditEventInput, "actorClerkId" | "actorRole"> & {
  actorClerkId?: string;
  actorRole?: AppRole;
}): Promise<void> {
  await logAuditEvent({
    ...input,
    actorClerkId: input.actorClerkId ?? "SYSTEM",
    actorRole: input.actorRole ?? "SUPER_ADMIN",
  });
}