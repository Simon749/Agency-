import { pgTable, uuid, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { tenantLedger } from "./tenant_ledger";

/**
 * Join table: which CREDIT entries paid off which DEBIT entries, and how much.
 *
 * Why a join table instead of a single `appliedToLedgerEntryId` column on
 * tenant_ledger: a single payment routinely clears several charges at once
 * (oldest arrears + current rent + a utility), and a single charge is often
 * paid off across more than one payment over time. Only a many-to-many
 * structure represents that correctly.
 *
 * Append-only, same as tenant_ledger itself — never update or delete rows.
 */
export const ledgerAllocations = pgTable("ledger_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  creditEntryId: uuid("credit_entry_id")
    .references(() => tenantLedger.id)
    .notNull(),
  debitEntryId: uuid("debit_entry_id")
    .references(() => tenantLedger.id)
    .notNull(),
  amountApplied: numeric("amount_applied", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_alloc_credit").on(table.creditEntryId),
  index("idx_alloc_debit").on(table.debitEntryId),
]);

export type LedgerAllocation = typeof ledgerAllocations.$inferSelect;
export type InsertLedgerAllocation = typeof ledgerAllocations.$inferInsert;