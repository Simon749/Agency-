import { pgTable, uuid, text, boolean, numeric } from "drizzle-orm/pg-core";
import { buildings } from "./buildings";
import { categoryEnum } from "./enums";

export const buildingUtilities = pgTable("building_utilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id")
    .references(() => buildings.id, { onDelete: "cascade" })
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  name: categoryEnum("name").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  rateType: text("rate_type").notNull(), // "FIXED" | "PER_UNIT"
  defaultAmount: numeric("default_amount", { precision: 10, scale: 2 }).default("0.00"),
  unit: text("unit"), // e.g. "m³" for water, "kWh" for electricity
});

export type BuildingUtility = typeof buildingUtilities.$inferSelect;
export type InsertBuildingUtility = typeof buildingUtilities.$inferInsert;