import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { agencies } from "./agencies";
import { buildings } from "./buildings";
import { tenants } from "./tenants";

export const aggregatorAccounts = pgTable("aggregator_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull(),
  buildingId: uuid("building_id")
    .references(() => buildings.id, { onDelete: "cascade" })
    .notNull(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  // Short account reference used for manual paybill payments (e.g., "PF123456")
  accountReference: text("account_reference").unique().notNull(),
  // The aggregator master shortcode this account is registered under
  aggregatorShortcode: text("aggregator_shortcode").notNull(),
  // For STK Push, we may use a different reference format
  stkPushReference: text("stk_push_reference").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AggregatorAccount = typeof aggregatorAccounts.$inferSelect;
export type InsertAggregatorAccount = typeof aggregatorAccounts.$inferInsert;

