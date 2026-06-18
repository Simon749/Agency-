// db/schema/staff.ts
// Staff table — links Clerk users to agencies for tracking & assignment.
// All role/auth checks still use Clerk publicMetadata (fast, middleware-safe).
// This table is for: hire date, status, assigned buildings, audit trail.

import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { agencies } from "./agencies";
import { roleEnum } from "./enums";

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique().notNull(), // FK to Clerk
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  role: roleEnum("role").notNull(), // MANAGER | FIELD_AGENT
  nationalId: text("national_id"), // KRA/labor compliance
  status: text("status").default("ACTIVE").notNull(), // ACTIVE | INACTIVE
  assignedBuildingIds: text("assigned_building_ids").array(), // buildings they cover
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deactivatedAt: timestamp("deactivated_at"),
});

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = typeof staff.$inferInsert;