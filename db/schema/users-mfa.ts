import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const usersMfa = pgTable("users_mfa", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique().notNull(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes"),
  status: text("status").default("PENDING").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
