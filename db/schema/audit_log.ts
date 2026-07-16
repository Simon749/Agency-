/**
 * AUDIT_LOG Schema — Phase B Foundation (created in Phase A migration)
 * 
 * This table is append-only. The application should never UPDATE or DELETE rows.
 * DB-level permissions should revoke UPDATE/DELETE from the app role.
 * 
 * Populated by:
 * - Super Admin bypass logging (lib/db/rls.ts)
 * - Application-level audit hooks (to be built in Phase B)
 * - DB triggers (optional, for low-level change tracking)
 */

import { pgTable, uuid, text, timestamp, jsonb, inet } from "drizzle-orm/pg-core";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Who did it
  actorClerkId: text("actor_clerk_id").notNull(),
  actorRole: text("actor_role").notNull(),

  // Which agency (null for Super Admin cross-agency actions)
  agencyId: uuid("agency_id"),

  // What happened
  action: text("action").notNull(), // "READ", "WRITE", "DELETE", "SUPER_ADMIN_BYPASS", "ROLE_CHANGE", etc.
  targetTable: text("target_table").notNull(),
  targetId: text("target_id"), // Primary key of affected row

  // Change details
  beforeValue: jsonb("before_value"), // Previous state (for updates)
  afterValue: jsonb("after_value"), // New state

  // Request context
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;