// lib/audit.ts
// Phase B: Structured audit logging. Every mutation that touches money,
// identity, or access control MUST call logAuditEvent().
//
// SECURITY: The audit_log table is append-only at the Postgres level.
// The application role has INSERT only — no UPDATE, no DELETE.
// See sql/append-only.sql for the DB-level enforcement.

import { getDb } from "@/lib/db";
import { auditLog } from "@/db/schema";
import type { InsertAuditLogEntry } from "@/db/schema";
import { log } from "@/lib/monitoring";
import { eq, desc } from "drizzle-orm";

export interface AuditEventInput {
  actorClerkId: string;
  actorRole: string;
  agencyId?: string | null;
  action: string;
  targetTable: string;
  targetId: string;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Log an audit event to the append-only audit_log table.
 * 
 * Usage:
 *   await logAuditEvent({
 *     actorClerkId: userId,
 *     actorRole: "MANAGER",
 *     agencyId: "uuid",
 *     action: "MANUAL_LEDGER_ENTRY_APPROVED",
 *     targetTable: "tenant_ledger",
 *     targetId: ledgerEntryId,
 *     beforeValue: { approvalStatus: "PENDING_APPROVAL" },
 *     afterValue: { approvalStatus: "APPROVED", approvedBy: userId },
 *   });
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const db = getDb();

    await db.insert(auditLog).values({
      actorClerkId: input.actorClerkId,
      actorRole: input.actorRole as any,
      agencyId: input.agencyId ?? null,
      action: input.action,
      targetTable: input.targetTable,
      targetId: input.targetId,
      beforeValue: input.beforeValue ?? null,
      afterValue: input.afterValue ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    // Audit logging must never break the main flow — log to console as fallback
    log("error", "Failed to write audit log entry", {
      service: "audit",
      error: err instanceof Error ? err : new Error(String(err)),
      metadata: { action: input.action, targetId: input.targetId },
    });
  }
}

/**
 * Query audit log for a specific target (e.g., "show me everything that
 * happened to tenant_ledger row X").
 */
export async function getAuditTrailForTarget(
  targetTable: string,
  targetId: string,
  limit: number = 50
) {
  const db = getDb();

  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.targetTable, targetTable) && eq(auditLog.targetId, targetId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

/**
 * Query audit log for an agency (Super Admin view).
 */
export async function getAuditTrailForAgency(
  agencyId: string,
  limit: number = 100,
  offset: number = 0
) {
  const db = getDb();

  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.agencyId, agencyId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Query audit log for actions by a specific actor.
 */
export async function getAuditTrailForActor(
  actorClerkId: string,
  limit: number = 50
) {
  const db = getDb();

  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.actorClerkId, actorClerkId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

// ── Re-export types for convenience ───────────────────────────────────────
export type { AuditLogEntry, InsertAuditLogEntry } from "@/db/schema";