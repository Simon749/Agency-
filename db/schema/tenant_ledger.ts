// lib/db/schema/tenant_ledger.ts
// UPDATED FOR PHASE F: Added idempotency constraint for billing cron
// The unique index on (tenantId, billingMonth, category) prevents double-billing.

import { pgTable, uuid, text, numeric, timestamp, uniqueIndex, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { buildings } from "./buildings";
import { entryTypeEnum, categoryEnum, paymentMethodEnum } from "./enums";

/**
 * THE CORE TABLE — append-only, never update or delete rows.
 * Balance is always calculated from the sum of all rows.
 *
 * PHASE C: Reversals via isReversal + reversesEntryId.
 * PHASE D: Maker-checker approval workflow.
 * PHASE F: Idempotency constraint on (tenantId, billingMonth, category)
 *          to prevent double-billing from cron retries.
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
  method: paymentMethodEnum("method").default("SYSTEM"),
  recordedBy: text("recorded_by"), // Clerk user ID of staff who logged it

  // ── PHASE C: reversals ──
  isReversal: boolean("is_reversal").default(false).notNull(),
  reversesEntryId: uuid("reverses_entry_id"),

  // ── PHASE D: maker-checker approval ──
  approvalStatus: text("approval_status").default("APPROVED").notNull(),
  submittedBy: text("submitted_by"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // ── PHASE F: IDEMPOTENCY ──
  // This prevents the billing cron from double-charging a tenant for the same
  // category in the same month. If cron runs twice, the second run hits this
  // constraint and skips the insert (handled gracefully in the batch worker).
  uniqueIndex("idx_ledger_tenant_month_category")
    .on(table.tenantId, table.billingMonth, table.category)
    // Partial index: only enforce for DEBIT entries (billing charges)
    // CREDIT entries (payments) use referenceCode uniqueness instead
    .where(sql`${table.type} = 'DEBIT'`),

  // Existing indexes preserved
  uniqueIndex("idx_ledger_reference_code").on(table.referenceCode),
  index("idx_ledger_reverses_entry").on(table.reversesEntryId),
  index("idx_ledger_approval_status").on(table.agencyId, table.approvalStatus),

  // Additional indexes for billing cron performance
  index("idx_ledger_tenant_billing_month").on(table.tenantId, table.billingMonth),
  index("idx_ledger_agency_created").on(table.agencyId, table.createdAt),
]);

export type TenantLedgerEntry = typeof tenantLedger.$inferSelect;
export type InsertTenantLedgerEntry = typeof tenantLedger.$inferInsert;