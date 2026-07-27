import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { agencies } from "./agencies";

export const buildings = pgTable("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id").references(() => agencies.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  locale: text("locale"),
  landlordName: text("landlord_name").notNull(),
  landlordPhone: text("landlord_phone"),
  darajaConsumerKey: text("daraja_consumer_key"),
  darajaConsumerSecret: text("daraja_consumer_secret"),
  darajaShortcode: text("daraja_shortcode"),
  darajaPasskey: text("daraja_passkey"),
  darajaCredentialsUpdatedAt: timestamp("daraja_credentials_updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
