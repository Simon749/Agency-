import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { agencies } from "./agencies";


export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  primaryChannel: text("primary_channel").default("SMS").notNull(),
  fallbackToSms: boolean("fallback_to_sms").default(true).notNull(),
  whatsappPhone: text("whatsapp_phone"),
  channelOverrides: text("channel_overrides"), // JSON string
  preferredChannel: text("preferred_channel").default("SMS").notNull(), // "SMS" | "WHATSAPP"
  notifyPaymentReceived: boolean("notify_payment_received").default(true).notNull(),
  notifyRentReminder: boolean("notify_rent_reminder").default(true).notNull(),
  notifyOverdue: boolean("notify_overdue").default(true).notNull(),
  notifyLeaseRenewal: boolean("notify_lease_renewal").default(true).notNull(),
  notifyComplaintFiled: boolean("notify_complaint_filed").default(true).notNull(),
  notifyComplaintResolved: boolean("notify_complaint_resolved").default(true).notNull(),
  notifyInviteSent: boolean("notify_invite_sent").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;


