import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { transactionStatusEnum } from "./enums";

export const pendingTransactions = pgTable("pending_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  buildingId: uuid("building_id").notNull(),
  checkoutRequestId: text("checkout_request_id").unique().notNull(), // from Daraja STK Push response
  merchantRequestId: text("merchant_request_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  phoneNumber: text("phone_number").notNull(),
  billingMonth: text("billing_month").notNull(),
  status: transactionStatusEnum("status").default("PENDING").notNull(),
  resultCode: text("result_code"),   // from Daraja callback
  resultDesc: text("result_desc"),
  mpesaReceiptNumber: text("mpesa_receipt_number"), // TransactionID on success
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PendingTransaction = typeof pendingTransactions.$inferSelect;
export type InsertPendingTransaction = typeof pendingTransactions.$inferInsert;