import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { units } from "./units";
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
  amountCharged: numeric("amount_charged", { precision: 10, scale: 2 }).notNull(),
  billingMonth: text("billing_month").notNull(), // "2025-01"
  readingImageUrl: text("reading_image_url"), // photo uploaded by field agent
  recordedBy: text("recorded_by").notNull(), // Clerk user ID of field agent
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UtilityReading = typeof utilityReadings.$inferSelect;
export type InsertUtilityReading = typeof utilityReadings.$inferInsert;