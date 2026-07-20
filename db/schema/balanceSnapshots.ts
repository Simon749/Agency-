import { pgTable, uuid, numeric, timestamp, text, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { tenantLedger } from "./tenant_ledger";

/**
 * A monthly checkpoint of a tenant's balance, so getTenantBalance() never has
 * to re-sum the tenant's entire ledger history — only rows since the cursor.
 *
 * cursorCreatedAt / cursorEntryId together identify the last ledger row folded
 * into this snapshot, using the same (created_at, id) tie-break that
 * getStatement.ts already relies on for ordering. Balance deltas are computed
 * with a strict "> cursor" tuple comparison, so no row is double-counted or
 * skipped at the boundary.
 */
export const balanceSnapshots = pgTable("balance_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  asOfMonth: text("as_of_month").notNull(), // "2026-07" — billing month this was taken after
  totalCharged: numeric("total_charged", { precision: 12, scale: 2 }).notNull(),
  totalPaid: numeric("total_paid", { precision: 12, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),
  cursorCreatedAt: timestamp("cursor_created_at").notNull(),
  cursorEntryId: uuid("cursor_entry_id")
    .references(() => tenantLedger.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_snapshot_tenant_cursor").on(table.tenantId, table.cursorCreatedAt),
]);

export type BalanceSnapshot = typeof balanceSnapshots.$inferSelect;
export type InsertBalanceSnapshot = typeof balanceSnapshots.$inferInsert;