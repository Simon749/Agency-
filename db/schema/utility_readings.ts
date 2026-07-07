import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { units } from "./units";
import { tenantLedger } from "./tenant_ledger";
import { categoryEnum } from "./enums";

export const utilityReadings = pgTable("utility_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .references(() => units.id)
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  buildingId: uuid("building_id").notNull(),
  utilityType: categoryEnum("utility_type").notNull(), // WATER | ELECTRICITY
  previousReading: numeric("previous_reading", { precision: 10, scale: 2 }).notNull(),
  currentReading: numeric("current_reading", { precision: 10, scale: 2 }).notNull(),
  unitsConsumed: numeric("units_consumed", { precision: 10, scale: 2 }).notNull(),
  ratePerUnit: numeric("rate_per_unit", { precision: 10, scale: 2 }).notNull(),
  // FIX: Renamed from "amountCharged" to "totalCharge" to match Design.md §4.2
  totalCharge: numeric("total_charge", { precision: 10, scale: 2 }).notNull(),
  billingMonth: text("billing_month").notNull(), // "2025-01"
  // FIX: Added ledgerEntryId FK back to tenant_ledger (Design.md §4.2)
  // Links this reading to the DEBIT row created when billed.
  ledgerEntryId: uuid("ledger_entry_id").references(() => tenantLedger.id),
  readingImageUrl: text("reading_image_url"), // photo uploaded by field agent
  recordedBy: text("recorded_by").notNull(), // Clerk user ID of field agent
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UtilityReading = typeof utilityReadings.$inferSelect;
export type InsertUtilityReading = typeof utilityReadings.$inferInsert;