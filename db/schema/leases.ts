import { pgTable, uuid, text, date, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { units } from "./units";
import { leaseStatusEnum } from "./enums";

export const leases = pgTable("leases", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  unitId: uuid("unit_id")
    .references(() => units.id)
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  rentAmount: numeric("rent_amount", { precision: 10, scale: 2 }).notNull(),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }).notNull(),
  depositPaid: boolean("deposit_paid").default(false),
  escalationType: text("escalation_type").default("FIXED"), // "FIXED" | "PERCENTAGE"
  escalationValue: numeric("escalation_value", { precision: 5, scale: 2 }),
  agreementTemplate: text("agreement_template"), // Markdown with {{placeholders}}
  agreementGenerated: text("agreement_generated"), // Final rendered text
  signedAt: timestamp("signed_at"),
  signedByTenantId: text("signed_by_clerk_id"),
  status: leaseStatusEnum("status").default("ACTIVE").notNull(),
  renewalReminderSentAt: timestamp("renewal_reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Lease = typeof leases.$inferSelect;
export type InsertLease = typeof leases.$inferInsert;