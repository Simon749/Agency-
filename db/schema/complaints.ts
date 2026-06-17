import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { complaintStatusEnum, complaintPriorityEnum } from "./enums";

export const complaints = pgTable("complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  buildingId: uuid("building_id").notNull(),
  unitId: uuid("unit_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category"), // "PLUMBING" | "ELECTRICAL" | "SECURITY" | "NOISE" | "OTHER"
  status: complaintStatusEnum("status").default("OPEN").notNull(),
  priority: complaintPriorityEnum("priority").default("MEDIUM").notNull(),
  imageUrl: text("image_url"),
  assignedTo: text("assigned_to"), // Clerk user ID of staff handling it
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const complaintUpdates = pgTable("complaint_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  complaintId: uuid("complaint_id")
    .references(() => complaints.id, { onDelete: "cascade" })
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  note: text("note").notNull(),
  statusChange: complaintStatusEnum("status_change"),
  updatedBy: text("updated_by").notNull(), // Clerk user ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = typeof complaints.$inferInsert;
export type ComplaintUpdate = typeof complaintUpdates.$inferSelect;
export type InsertComplaintUpdate = typeof complaintUpdates.$inferInsert;