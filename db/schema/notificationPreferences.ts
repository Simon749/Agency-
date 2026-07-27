import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(), // Clerk user ID
  agencyId: uuid("agency_id").notNull(),
  primaryChannel: text("primary_channel").default("SMS").notNull(), // "SMS" | "WHATSAPP"
  whatsappPhone: text("whatsapp_phone"),
  whatsappOptIn: boolean("whatsapp_opt_in").default(false).notNull(),
  whatsappVerifiedAt: timestamp("whatsapp_verified_at"),
  fallbackToSms: boolean("fallback_to_sms").default(true).notNull(),
  // Per-message-type overrides (JSON for flexibility)
  channelOverrides: text("channel_overrides"), // JSON string: {"PAYMENT":"WHATSAPP","REMINDER":"SMS"}
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;