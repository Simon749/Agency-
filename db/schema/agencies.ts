import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  phone: text("phone").notNull(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true).notNull(), // Super Admin kill switch
  subscriptionStatus: text("subscription_status").default("TRIAL"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Agency = typeof agencies.$inferSelect;
export type InsertAgency = typeof agencies.$inferInsert;