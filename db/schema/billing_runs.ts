//db/schema/billing_runs.ts
// PHASE F: Billing run tracking for fan-out queue pattern
// Each row represents one billing batch (per-building or per-batch-of-tenants)

import { pgTable, uuid, text, timestamp, integer, jsonb, unique, pgEnum } from "drizzle-orm/pg-core";
import { agencies } from "./agencies";
import { buildings } from "./buildings";

export const billingRunStatusEnum = pgEnum("billing_run_status", [
  "PENDING", "RUNNING", "COMPLETE", "FAILED", "RETRYING",
]);

export const billingRuns = pgTable("billing_runs", {
  id: uuid("id").primaryKey().defaultRandom(),

  // What is being billed
  billingMonth: text("billing_month").notNull(), // "2026-07"

  // Scope: one run per building (fan-out unit)
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull(),
  buildingId: uuid("building_id")
    .references(() => buildings.id, { onDelete: "cascade" })
    .notNull(),

  // Status tracking
  status: billingRunStatusEnum("status").default("PENDING").notNull(),

  // Progress counters
  totalTenants: integer("total_tenants").default(0),
  processedTenants: integer("processed_tenants").default(0),
  entriesInserted: integer("entries_inserted").default(0),
  entriesSkipped: integer("entries_skipped").default(0), // idempotency hits

  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"), // stack trace, context, etc.

  // Retry tracking
  attemptCount: integer("attempt_count").default(0),
  maxAttempts: integer("max_attempts").default(3),

  // QStash job tracking
  qstashMessageId: text("qstash_message_id"), // for tracing
  qstashScheduleId: text("qstash_schedule_id"), // if scheduled

  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("billing_runs_building_month_unique").on(table.buildingId, table.billingMonth),
]
);

export type BillingRun = typeof billingRuns.$inferSelect;
export type InsertBillingRun = typeof billingRuns.$inferInsert;