// lib/db/schema/audit_log.ts
// Phase B — Append-only audit trail. Every mutation that touches money,
// identity, or access control MUST call logAuditEvent().
//
// SECURITY: This table is append-only at the Postgres level (see sql/append-only.sql).
// The application role has INSERT only — no UPDATE, no DELETE.

import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { roleEnum } from "./enums";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),

  // ── Actor ───────────────────────────────────────────────────────────────
  actorClerkId: text("actor_clerk_id").notNull(),
  actorRole: roleEnum("actor_role").notNull(),

  // ── Scope ───────────────────────────────────────────────────────────────
  agencyId: uuid("agency_id"), // null for super-admin cross-agency actions

  // ── Action ──────────────────────────────────────────────────────────────
  action: text("action").notNull(),
  // Actions:
  //   ROLE_CHANGE, DARAJA_CREDENTIAL_UPDATE, RENT_AMOUNT_EDIT,
  //   DEPOSIT_AMOUNT_EDIT, KILL_SWITCH_TOGGLE, NATIONAL_ID_ACCESS,
  //   TENANT_REMOVE, STAFF_REMOVE, MANUAL_LEDGER_ENTRY, LEDGER_REVERSAL,
  //   STAFF_INVITE, TENANT_INVITE, TENANT_VACATE, COMPLAINT_ASSIGN,
  //   UTILITY_RATE_CHANGE, BUILDING_CREATE, BUILDING_DELETE

  targetTable: text("target_table").notNull(),
  targetId: text("target_id").notNull(), // primary key of the affected row

  // ── Snapshots ───────────────────────────────────────────────────────────
  // Store the full row state before and after the mutation.
  // Use jsonb for indexing, querying, and diffing.
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),

  // ── Context ─────────────────────────────────────────────────────────────
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  // ── Timestamp ───────────────────────────────────────────────────────────
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLogEntry = typeof auditLog.$inferInsert;