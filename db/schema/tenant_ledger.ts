import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { buildings } from "./buildings";
import { entryTypeEnum, categoryEnum, paymentMethodEnum } from "./enums";

/**
 * THE CORE TABLE — append-only, never update or delete rows.
 * Balance is always calculated from the sum of all rows (see lib/ledger.ts).
 */
export const tenantLedger = pgTable("tenant_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  buildingId: uuid("building_id")
    .references(() => buildings.id)
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  type: entryTypeEnum("type").notNull(), // DEBIT or CREDIT
  category: categoryEnum("category").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  billingMonth: text("billing_month").notNull(), // "2025-01" format
  description: text("description"),
  referenceCode: text("reference_code"), // M-Pesa TransactionID or manual receipt ref
  paymentMethod: paymentMethodEnum("payment_method"),
  recordedBy: text("recorded_by"), // Clerk user ID of staff who logged it
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TenantLedgerEntry = typeof tenantLedger.$inferSelect;
export type InsertTenantLedgerEntry = typeof tenantLedger.$inferInsert;