// lib/audit/queries.ts
// Phase B — Query helpers for the audit log.
// Used by: Super Admin dashboard, agency owner compliance view, runbooks.

"use server";

import { getDb } from "@/lib/db";
import { auditLog } from "@/db/schema";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import type { AuditLogEntry } from "@/db/schema";

export interface AuditQueryFilters {
  agencyId?: string;
  actorClerkId?: string;
  targetTable?: string;
  targetId?: string;
  action?: string;
  days?: number; // default 30
}

/**
 * Fetch audit log entries with optional filters.
 * Ordered newest first. Returns up to 1,000 rows — paginate for more.
 */
export async function getAuditLogEntries(
  filters: AuditQueryFilters = {}
): Promise<AuditLogEntry[]> {
  const days = filters.days ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const db = getDb();
  const conditions = [gte(auditLog.createdAt, since)];

  if (filters.agencyId) {
    conditions.push(eq(auditLog.agencyId, filters.agencyId));
  }
  if (filters.actorClerkId) {
    conditions.push(eq(auditLog.actorClerkId, filters.actorClerkId));
  }
  if (filters.targetTable) {
    conditions.push(eq(auditLog.targetTable, filters.targetTable));
  }
  if (filters.targetId) {
    conditions.push(eq(auditLog.targetId, filters.targetId));
  }
  if (filters.action) {
    conditions.push(eq(auditLog.action, filters.action));
  }

  return db
    .select()
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt))
    .limit(1000);
}

/**
 * Get every action on a specific agency in the last N days.
 * Primary use case: Super Admin compliance review.
 */
export async function getAgencyAuditTrail(
  agencyId: string,
  days: number = 30
): Promise<AuditLogEntry[]> {
  return getAuditLogEntries({ agencyId, days });
}

/**
 * Get all actions performed by a specific user.
 */
export async function getActorAuditTrail(
  actorClerkId: string,
  days: number = 30
): Promise<AuditLogEntry[]> {
  return getAuditLogEntries({ actorClerkId, days });
}

/**
 * Get the complete history of a single record (by table + id).
 * Shows every mutation ever logged for this entity.
 */
export async function getRecordHistory(
  targetTable: string,
  targetId: string,
  days: number = 365
): Promise<AuditLogEntry[]> {
  return getAuditLogEntries({ targetTable, targetId, days });
}

/**
 * Get a summary of actions per agency (for Super Admin dashboard).
 */
export async function getAuditSummaryByAgency(days: number = 30): Promise<
  { agencyId: string | null; actionCount: number; lastActionAt: Date | null }[]
> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const db = getDb();
  const rows = await db
    .select({
      agencyId: auditLog.agencyId,
      actionCount: sql<number>`count(*)::int`,
      lastActionAt: sql<Date | null>`max(${auditLog.createdAt})`,
    })
    .from(auditLog)
    .where(gte(auditLog.createdAt, since))
    .groupBy(auditLog.agencyId);

  return rows;
}

/**
 * Get the most recent audit entry for a record — useful for "last modified" displays.
 */
export async function getLastAuditEntry(
  targetTable: string,
  targetId: string
): Promise<AuditLogEntry | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.targetTable, targetTable),
        eq(auditLog.targetId, targetId)
      )
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(1);

  return rows[0] ?? null;
}