import { pgTable, uuid, text, numeric, timestamp, uniqueIndex, boolean, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { buildings } from "./buildings";
import { entryTypeEnum, categoryEnum, paymentMethodEnum } from "./enums";

/**
 * THE CORE TABLE — append-only, never update or delete rows.
 * Balance is always calculated from the sum of all rows (see lib/ledger/getBalance.ts).
 *
 * PHASE C: added isReversal / reversesEntryId. A reversal is a normal DEBIT or
 * CREDIT row (so existing SUM(DEBIT)-SUM(CREDIT) balance math needs zero
 * changes) that is flagged as offsetting a prior entry. The original row is
 * never touched — see lib/ledger/reverseLedgerEntry.ts.
 *
 * PHASE D: added maker-checker approval workflow. Field Agent submissions go
 * through PENDING_APPROVAL before affecting the live balance. Only MANAGER or
 * AGENCY_OWNER can approve/reject.
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
  // Plain uuid, not a drizzle .references() self-FK (avoids the circular-type
  // headache) — the actual foreign key is added at the DB level in the
  // migration SQL. Query it like any other column.
  reversesEntryId: uuid("reverses_entry_id"),

  // ── PHASE D: maker-checker approval ──
  approvalStatus: text("approval_status").default("APPROVED").notNull(),
  // "APPROVED" | "PENDING_APPROVAL" | "REJECTED"

  submittedBy: text("submitted_by"), // Field Agent who submitted (for PENDING entries)
  approvedBy: text("approved_by"),   // Manager who approved
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"), // Why it was rejected

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_ledger_reference_code").on(table.referenceCode),
  index("idx_ledger_reverses_entry").on(table.reversesEntryId),
  index("idx_ledger_approval_status").on(table.agencyId, table.approvalStatus), // ← PHASE D: for pending approvals query
]);

export type TenantLedgerEntry = typeof tenantLedger.$inferSelect;
export type InsertTenantLedgerEntry = typeof tenantLedger.$inferInsert;