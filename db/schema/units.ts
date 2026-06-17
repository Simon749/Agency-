import { pgTable, uuid, text, boolean, numeric } from "drizzle-orm/pg-core";
import { buildings } from "./buildings";

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id")
    .references(() => buildings.id, { onDelete: "cascade" })
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  unitNumber: text("unit_number").notNull(), // e.g. "A1", "B3", "GF-01"
  floor: text("floor"),
  type: text("type"), // "1BR" | "2BR" | "STUDIO" | "BEDSITTER"
  rentAmount: numeric("rent_amount", { precision: 10, scale: 2 }).notNull(),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }).notNull(),
  isOccupied: boolean("is_occupied").default(false).notNull(),
});

export type Unit = typeof units.$inferSelect;
export type InsertUnit = typeof units.$inferInsert;