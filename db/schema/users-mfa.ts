import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const mfaStatusEnum = pgEnum("mfa_status", ["PENDING", "ENABLED", "DISABLED"]);

export const usersMfa = pgTable("users_mfa", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique().notNull(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").array().notNull(),
  status: mfaStatusEnum("status").default("PENDING").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});