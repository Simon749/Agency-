import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { agencies } from "./agencies";

export const buildings = pgTable("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  locale: text("locale"), // e.g. "Westlands", "Karen", "Mombasa"
  landlordName: text("landlord_name").notNull(),
  landlordPhone: text("landlord_phone"),
  // Daraja credentials — stored encrypted at rest (Week 5)
  darajaConsumerKey: text("daraja_consumer_key"),
  darajaConsumerSecret: text("daraja_consumer_secret"),
  darajaShortcode: text("daraja_shortcode"),
  darajaPasskey: text("daraja_passkey"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Building = typeof buildings.$inferSelect;
export type InsertBuilding = typeof buildings.$inferInsert;