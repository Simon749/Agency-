import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Both name and email are unique — enforced at DB level.
  // Application-level checks in createAgencyAndInviteOwner return clean errors
  // before hitting this constraint.
  name: text("name").unique().notNull(),
  email: text("email").unique().notNull(),
  phone: text("phone").notNull(),
  logoUrl: text("logo_url"),

  // Tracks whether the invited Agency Owner has accepted their Clerk invite.
  // Set to "INVITED" on agency creation, updated to "ACCEPTED" by the Clerk webhook
  // when the owner completes sign-up.
  // "ACTIVE" is set automatically once inviteStatus = "ACCEPTED" (handled in webhook).
  inviteStatus: text("invite_status").default("PENDING").notNull(),

  isActive: boolean("is_active").default(true).notNull(), // Super Admin kill switch
  subscriptionStatus: text("subscription_status").default("TRIAL"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Agency = typeof agencies.$inferSelect;
export type InsertAgency = typeof agencies.$inferInsert;