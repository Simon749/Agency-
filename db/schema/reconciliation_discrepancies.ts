// lib/db/schema/reconciliation_discrepancies.ts
// Phase D: Logs unmatched transactions between Daraja settlement and tenant_ledger.
// Every shilling must be traceable — this table catches the exceptions.

import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { buildings } from "./buildings";

export const reconciliationDiscrepancies = pgTable("reconciliation_discrepancies", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id").notNull(),
  buildingId: uuid("building_id")
    .references(() => buildings.id)
    .notNull(),

  // What kind of mismatch?
  discrepancyType: text("discrepancy_type").notNull(),
  // "DARAJA_MISSING"    — we have a ledger CREDIT but no matching Daraja transaction
  // "LEDGER_MISSING"    — Daraja shows a transaction but no ledger CREDIT
  // "AMOUNT_MISMATCH"   — both exist but amounts differ
  // "TENANT_MISMATCH"   — Daraja BillRefNumber doesn't match any tenant
  // "DUPLICATE_DARAJA"  — same TransID appears multiple times in Daraja

  // Daraja side
  darajaTransactionId: text("daraja_transaction_id"), // TransID from Safaricom
  darajaAmount: numeric("daraja_amount", { precision: 10, scale: 2 }),
  darajaPhone: text("daraja_phone"),
  darajaTimestamp: text("daraja_timestamp"), // "20260720123045"

  // Ledger side
  ledgerEntryId: uuid("ledger_entry_id"),
  ledgerReferenceCode: text("ledger_reference_code"),
  ledgerAmount: numeric("ledger_amount", { precision: 10, scale: 2 }),
  ledgerTenantId: uuid("ledger_tenant_id"),

  // Reconciliation metadata
  reportDate: text("report_date").notNull(), // "2026-07-20" — which day's settlement
  status: text("status").default("UNRESOLVED").notNull(),
  // "UNRESOLVED" | "INVESTIGATING" | "RESOLVED" | "FALSE_POSITIVE"

  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"), // Clerk user ID
  resolutionNotes: text("resolution_notes"),
  reason: text("reason"), // Human-readable explanation of the discrepancy

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ReconciliationDiscrepancy = typeof reconciliationDiscrepancies.$inferSelect;
export type InsertReconciliationDiscrepancy = typeof reconciliationDiscrepancies.$inferInsert;