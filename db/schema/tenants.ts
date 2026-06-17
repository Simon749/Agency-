import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { buildings } from "./buildings";
import { units } from "./units";
import { leaseStatusEnum } from "./enums";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique(), // set after they accept the invite
  agencyId: uuid("agency_id").notNull(),
  buildingId: uuid("building_id")
    .references(() => buildings.id)
    .notNull(),
  unitId: uuid("unit_id")
    .references(() => units.id)
    .notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(), // used for STK Push
  email: text("email"),
  nationalId: text("national_id"),
  inviteStatus: text("invite_status").default("PENDING"), // "PENDING" | "ACCEPTED"
  status: leaseStatusEnum("status").default("ACTIVE").notNull(),
  vacatedAt: timestamp("vacated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;