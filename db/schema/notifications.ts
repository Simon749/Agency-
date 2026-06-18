// lib/db/schema/notifications.ts
// In-app notification bell system (optional for MVP, but schema-ready).

import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),           // Clerk user ID
  agencyId: uuid("agency_id").notNull(),
  type: text("type").notNull(),                // "PAYMENT" | "COMPLAINT" | "LEASE" | "REMINDER"
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  linkUrl: text("link_url"),                   // e.g. "/tenant/ledger"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;