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
  // FIX: Changed from single "imageUrl" to "photoUrls" array to match Design.md §4.2
  // Tenants may upload multiple photos per complaint.
  photoUrls: text("photo_urls").array(),
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
  // FIX: Aligned field names with Design.md §4.2
  // "authorClerkId" instead of "updatedBy", "message" instead of "note"
  authorClerkId: text("author_clerk_id").notNull(),
  message: text("message").notNull(),
  // Kept "statusChange" as it's useful for audit trail (not in Design.md but valuable)
  statusChange: complaintStatusEnum("status_change"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = typeof complaints.$inferInsert;
export type ComplaintUpdate = typeof complaintUpdates.$inferSelect;
export type InsertComplaintUpdate = typeof complaintUpdates.$inferInsert;