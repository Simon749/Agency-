import { pgTable, uuid, text, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const stkPushQueueStatusEnum = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;

export const stkPushQueue = pgTable("stk_push_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  buildingId: uuid("building_id").notNull(),
  agencyId: uuid("agency_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  phone: text("phone").notNull(),
  accountReference: text("account_reference").notNull(),
  transactionDesc: text("transaction_desc"),
  // Which shortcode/aggregator this request should use
  shortcodeType: text("shortcode_type").default("OWN").notNull(), // "OWN" | "AGGREGATOR"
  aggregatorAccountId: uuid("aggregator_account_id"),
  
  status: text("status").default("PENDING").notNull(),
  scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  attemptCount: integer("attempt_count").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  
  // Link to pending_transactions once initiated
  pendingTransactionId: uuid("pending_transaction_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StkPushQueueItem = typeof stkPushQueue.$inferSelect;
export type InsertStkPushQueueItem = typeof stkPushQueue.$inferInsert;