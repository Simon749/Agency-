import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  numeric,
  date,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";


// ── Enums ──────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "SUPER_ADMIN",
  "AGENCY_OWNER",
  "MANAGER",
  "FIELD_AGENT",
  "TENANT",
]);

export const leaseStatusEnum = pgEnum("lease_status", [
  "ACTIVE",
  "PENDING_RENEWAL",
  "VACATED",
  "TERMINATED",
]);

export const entryTypeEnum = pgEnum("entry_type", ["DEBIT", "CREDIT"]);

export const categoryEnum = pgEnum("category", [
  "RENT",
  "WATER",
  "ELECTRICITY",
  "GARBAGE",
  "SERVICE_CHARGE",
  "WIFI",
  "SECURITY",
  "PREVIOUS_BALANCE",
  "DEPOSIT",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "MPESA_STK",
  "BANK_RECEIPT",
  "CASH",
  "SYSTEM",
]);

export const complaintStatusEnum = pgEnum("complaint_status", [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

export const complaintPriorityEnum = pgEnum("complaint_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REJECTED",
]);


// ── NEW: Subscription & Termination Enums ─────────────────────────

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "TRIAL",
  "STARTER",
  "GROWTH",
  "ENTERPRISE",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "ACTIVE",
  "OVERDUE",
  "SUSPENDED",
  "CANCELLED",
]);

export const subscriptionPaymentMethodEnum = pgEnum("subscription_payment_method", [
  "MPESA_PAYBILL",
  "BANK_TRANSFER",
  "CASH",
  "SYSTEM",
]);

export const subscriptionPaymentStatusEnum = pgEnum("subscription_payment_status", [
  "PENDING",
  "CONFIRMED",
  "REJECTED",
]);

export const terminationReasonEnum = pgEnum("termination_reason", [
  "CONTRACT_ENDED",
  "NON_PAYMENT",
  "BREACH_OF_TERMS",
  "REQUESTED_BY_AGENCY",
  "OTHER",
]);

export const mfaStatusEnum = pgEnum("mfa_status", [
  "PENDING",
  "ENABLED",
  "DISABLED"
]);

export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true).notNull(),
  subscriptionStatus: text("subscription_status").default("TRIAL"),

  inviteStatus: text("invite_status").default("PENDING").notNull(),
  // ── Soft delete & termination (NEW) ──────────────────────────────
  deletedAt: timestamp("deleted_at"),                    // null = active, set = terminated
  terminationReason: terminationReasonEnum("termination_reason"), // why contract ended
  terminatedBy: text("terminated_by"),                   // Super Admin clerkUserId
  dataExportedAt: timestamp("data_exported_at"),          // when archive was generated
  gracePeriodEndsAt: timestamp("grace_period_ends_at"),  // for subscription grace periods
  defaultCommissionRate: numeric("default_commission_rate", { precision: 5, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Staff ──────────────────────────────────────────────────────────

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique().notNull(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  role: roleEnum("role").notNull(),
  nationalId: text("national_id"),
  status: text("status").default("ACTIVE").notNull(),
  assignedBuildingIds: text("assigned_building_ids").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deactivatedAt: timestamp("deactivated_at"),
});

// ── STK Push Queue ──────────────────────────────────────────────

export const stkPushQueue = pgTable("stk_push_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  buildingId: uuid("building_id").notNull(),
  agencyId: uuid("agency_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  phone: text("phone").notNull(),
  accountReference: text("account_reference").notNull(),
  transactionDesc: text("transaction_desc"),
  // Which shortcode/aggregator this request should use
  shortcodeType: text("shortcode_type").default("OWN").notNull(), // "OWN" | "AGGREGATOR"
  aggregatorAccountId: uuid("aggregator_account_id"),

  status: text("status").default("PENDING").notNull(),
  scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  attemptCount: integer("attempt_count").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),

  // Link to pending_transactions once initiated
  pendingTransactionId: uuid("pending_transaction_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// ── Notification Preferences ──────────────────────────────────────────────

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
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


// ── aggregatorAccounts ──────────────────────────────────────────────────────

export const aggregatorAccounts = pgTable("aggregator_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull(),
  buildingId: uuid("building_id")
    .references(() => buildings.id, { onDelete: "cascade" })
    .notNull(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  // Short account reference used for manual paybill payments (e.g., "PF123456")
  accountReference: text("account_reference").unique().notNull(),
  // The aggregator master shortcode this account is registered under
  aggregatorShortcode: text("aggregator_shortcode").notNull(),
  // For STK Push, we may use a different reference format
  stkPushReference: text("stk_push_reference").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
// ── Buildings ──────────────────────────────────────────────────────

export const buildings = pgTable("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  locale: text("locale"),
  landlordName: text("landlord_name").notNull(),
  landlordPhone: text("landlord_phone"),
  darajaInitiatorName: text("daraja_initiator_name"),
  darajaSecurityCredential: text("daraja_security_credential"),
  darajaConsumerKey: text("daraja_consumer_key"),
  darajaConsumerSecret: text("daraja_consumer_secret"),
  darajaShortcode: text("daraja_shortcode"),
  darajaPasskey: text("daraja_passkey"),
  darajaCredentialsUpdatedAt: timestamp("daraja_credentials_updated_at"), // ← add this
  paymentMode: text("payment_mode").default("OWN_SHORTCODE").notNull(), // "OWN_SHORTCODE" | "AGGREGATOR"
  agreementTemplate: text("agreement_template"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // ← add this too, buildings.ts (dead file) had it and it's generally useful
});


// ── Building Utilities ─────────────────────────────────────────────

export const buildingUtilities = pgTable("building_utilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id")
    .references(() => buildings.id, { onDelete: "cascade" })
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  name: categoryEnum("name").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  rateType: text("rate_type").notNull(),
  defaultAmount: numeric("default_amount", { precision: 10, scale: 2 }).default(
    "0.00",
  ),
  unit: text("unit"),
});

// ── Units ──────────────────────────────────────────────────────────

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id")
    .references(() => buildings.id, { onDelete: "cascade" })
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  unitNumber: text("unit_number").notNull(),
  floor: text("floor"),
  type: text("type"),
  rentAmount: numeric("rent_amount", { precision: 10, scale: 2 }).notNull(),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }).notNull(),
  isOccupied: boolean("is_occupied").default(false).notNull(),
});


// ── Billing Runs ──────────────────────────────────────────────────

export const billingRuns = pgTable("billing_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id").notNull(),
  buildingId: uuid("building_id").notNull(),
  billingMonth: text("billing_month").notNull(), // "2026-08"
  status: text("status").default("PENDING").notNull(), // PENDING | RUNNING |
  attemptCount: integer("attempt_count").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  totalTenants: integer("total_tenants").default(0),
  processedTenants: integer("processed_tenants").default(0),
  entriesInserted: integer("entries_inserted").default(0),
  entriesSkipped: integer("entries_skipped").default(0),
  errorMessage: text("error_message"),
  qstashMessageId: text("qstash_message_id"), // for tracing
  qstashScheduleId: text("qstash_schedule_id"), // if scheduled
  errorDetails: jsonb("error_details"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  errorLog: jsonb("error_log").default([]), // Array of {tenantId, error, retryCount}
});

// ── Tenants ────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique(),
  agencyId: uuid("agency_id").notNull(),
  buildingId: uuid("building_id")
    .references(() => buildings.id)
    .notNull(),
  unitId: uuid("unit_id")
    .references(() => units.id)
    .notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  nationalId: text("national_id"),
  inviteStatus: text("invite_status").default("PENDING"),
  status: leaseStatusEnum("status").default("ACTIVE").notNull(),
  vacatedAt: timestamp("vacated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Leases ─────────────────────────────────────────────────────────

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
  escalationType: text("escalation_type").default("FIXED"),
  escalationValue: numeric("escalation_value", { precision: 5, scale: 2 }),
  agreementTemplate: text("agreement_template"),
  agreementGenerated: text("agreement_generated"),
  signedAt: timestamp("signed_at"),
  signedByTenantId: text("signed_by_clerk_id"),
  status: leaseStatusEnum("status").default("ACTIVE").notNull(),
  renewalReminderSentAt: timestamp("renewal_reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Tenant Ledger ──────────────────────────────────────────────────

export const tenantLedger = pgTable("tenant_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  buildingId: uuid("building_id")
    .references(() => buildings.id)
    .notNull(),
  agencyId: uuid("agency_id").notNull(),
  type: entryTypeEnum("type").notNull(),
  category: categoryEnum("category").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").default("SYSTEM"),
  referenceCode: text("reference_code").unique(),
  description: text("description").notNull(),
  billingMonth: text("billing_month"),
  recordedBy: text("recorded_by"),
  approvalStatus: text("approval_status").notNull().default("PENDING"),
  isReversal: boolean("is_reversal").default(false).notNull(),
  reversesEntryId: uuid("reverses_entry_id"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Utility Readings ───────────────────────────────────────────────

export const utilityReadings = pgTable("utility_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .references(() => units.id)
    .notNull(),
  buildingId: uuid("building_id").notNull(),
  agencyId: uuid("agency_id").notNull(),
  agentClerkId: text("agent_clerk_id").notNull(),
  utilityType: categoryEnum("utility_type").notNull(),
  previousReading: numeric("previous_reading", { precision: 10, scale: 2 }).notNull(),
  currentReading: numeric("current_reading", { precision: 10, scale: 2 }).notNull(),
  unitsConsumed: numeric("units_consumed", { precision: 10, scale: 2 }).notNull(),
  ratePerUnit: numeric("rate_per_unit", { precision: 10, scale: 2 }).notNull(),
  totalCharge: numeric("total_charge", { precision: 10, scale: 2 }).notNull(),
  billingMonth: text("billing_month").notNull(),
  ledgerEntryId: uuid("ledger_entry_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Pending Transactions ───────────────────────────────────────────

export const pendingTransactions = pgTable("pending_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  buildingId: uuid("building_id").notNull(),
  agencyId: uuid("agency_id").notNull(),
  checkoutRequestId: text("checkout_request_id").unique().notNull(),
  merchantRequestId: text("merchant_request_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  phone: text("phone").notNull(),
  status: transactionStatusEnum("status").default("PENDING").notNull(),
  mpesaCode: text("mpesa_code").unique(),
  resultCode: text("result_code"),
  resultDesc: text("result_desc"),
  failureReason: text("failure_reason"),
  initiatedAt: timestamp("initiated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ── Complaints ─────────────────────────────────────────────────────

export const complaints = pgTable("complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  buildingId: uuid("building_id").notNull(),
  agencyId: uuid("agency_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: complaintPriorityEnum("priority").default("MEDIUM").notNull(),
  status: complaintStatusEnum("status").default("OPEN").notNull(),
  photoUrls: text("photo_urls").array(),
  assignedTo: text("assigned_to"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Complaint Updates ──────────────────────────────────────────────

export const complaintUpdates = pgTable("complaint_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  complaintId: uuid("complaint_id")
    .references(() => complaints.id)
    .notNull(),
  authorClerkId: text("author_clerk_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// ═══════════════════════════════════════════════════════════════════════
// NEW: Subscription Management Tables
// ═══════════════════════════════════════════════════════════════════════

// ── Agency Subscriptions ─────────────────────────────────────────────

export const agencySubscriptions = pgTable("agency_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull(),

  plan: subscriptionPlanEnum("plan").default("TRIAL").notNull(),
  amountKes: numeric("amount_kes", { precision: 10, scale: 2 }).notNull(),
  billingCycle: text("billing_cycle").default("MONTHLY").notNull(),

  status: subscriptionStatusEnum("status").default("ACTIVE").notNull(),
  paidThroughDate: date("paid_through_date"),
  nextBillingDate: date("next_billing_date"),
  trialEndsAt: date("trial_ends_at"),

  paymentMethod: subscriptionPaymentMethodEnum("payment_method").default("MPESA_PAYBILL"),
  mpesaPaybillNumber: text("mpesa_paybill_number"),
  mpesaAccountNumber: text("mpesa_account_number"),
  bankReferencePrefix: text("bank_reference_prefix"),

  gracePeriodDays: numeric("grace_period_days", { precision: 3, scale: 0 }).default("7"),
  overdueSince: timestamp("overdue_since"),

  reminder7DaySentAt: timestamp("reminder_7_day_sent_at"),
  reminder1DaySentAt: timestamp("reminder_1_day_sent_at"),
  overdueNoticeSentAt: timestamp("overdue_notice_sent_at"),
  suspensionNoticeSentAt: timestamp("suspension_notice_sent_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Subscription Payments (Super Admin revenue ledger) ─────────────

export const subscriptionPayments = pgTable("subscription_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id, { onDelete: "cascade" })
    .notNull(),
  subscriptionId: uuid("subscription_id")
    .references(() => agencySubscriptions.id, { onDelete: "cascade" }),

  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: subscriptionPaymentMethodEnum("method").notNull(),
  status: subscriptionPaymentStatusEnum("status").default("PENDING").notNull(),
  referenceCode: text("reference_code"),

  recordedBy: text("recorded_by"),
  receiptUrl: text("receipt_url"),
  notes: text("notes"),

  billingPeriodStart: date("billing_period_start"),
  billingPeriodEnd: date("billing_period_end"),

  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: text("confirmed_by"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// ── reconciliation_discrepancies ───────────────────────────────────────────────

export const reconciliationDiscrepancies = pgTable("reconciliation_discrepancies", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id").notNull(),
  buildingId: uuid("building_id").notNull(),
  discrepancyType: text("discrepancy_type").notNull(),

  darajaTransactionId: text("daraja_transaction_id"),
  darajaAmount: numeric("daraja_amount", { precision: 10, scale: 2 }),
  darajaPhone: text("daraja_phone"),
  darajaTimestamp: text("daraja_timestamp"),

  ledgerEntryId: uuid("ledger_entry_id"),
  ledgerReferenceCode: text("ledger_reference_code"),
  ledgerAmount: numeric("ledger_amount", { precision: 10, scale: 2 }),
  ledgerTenantId: uuid("ledger_tenant_id"),

  amount: numeric("amount", { precision: 10, scale: 2 }),
  expectedAmount: numeric("expected_amount", { precision: 10, scale: 2 }),
  transactionDate: timestamp("transaction_date"),
  reportDate: text("report_date"),
  reason: text("reason"),

  status: text("status").default("UNRESOLVED"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── usersMfa ───────────────────────────────────────────────────

export const usersMfa = pgTable("users_mfa", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique().notNull(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").array().notNull(), // <-- must be .array()
  status: mfaStatusEnum("status").default("PENDING").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


// ── Type Exports ───────────────────────────────────────────────────

export type Agency = typeof agencies.$inferSelect;
export type InsertAgency = typeof agencies.$inferInsert;

export type Building = typeof buildings.$inferSelect;
export type InsertBuilding = typeof buildings.$inferInsert;

export type BuildingUtility = typeof buildingUtilities.$inferSelect;
export type InsertBuildingUtility = typeof buildingUtilities.$inferInsert;

export type Unit = typeof units.$inferSelect;
export type InsertUnit = typeof units.$inferInsert;

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

export type Lease = typeof leases.$inferSelect;
export type InsertLease = typeof leases.$inferInsert;

export type TenantLedgerEntry = typeof tenantLedger.$inferSelect;
export type InsertTenantLedgerEntry = typeof tenantLedger.$inferInsert;

export type UtilityReading = typeof utilityReadings.$inferSelect;
export type InsertUtilityReading = typeof utilityReadings.$inferInsert;

export type PendingTransaction = typeof pendingTransactions.$inferSelect;
export type InsertPendingTransaction = typeof pendingTransactions.$inferInsert;

export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = typeof complaints.$inferInsert;

export type ComplaintUpdate = typeof complaintUpdates.$inferSelect;
export type InsertComplaintUpdate = typeof complaintUpdates.$inferInsert;

export type ReconciliationDiscrepancy = typeof reconciliationDiscrepancies.$inferSelect;
export type InsertReconciliationDiscrepancy = typeof reconciliationDiscrepancies.$inferInsert;

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = typeof staff.$inferInsert;
export type StaffRole = Staff["role"];

// NEW type exports
export type AgencySubscription = typeof agencySubscriptions.$inferSelect;
export type InsertAgencySubscription = typeof agencySubscriptions.$inferInsert;

export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type InsertSubscriptionPayment = typeof subscriptionPayments.$inferInsert;

// ── Audit Log ──────────────────────────────────────────────────────

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorClerkId: text("actor_clerk_id").notNull(),
  actorRole: roleEnum("actor_role").notNull(),
  agencyId: uuid("agency_id"),
  action: text("action").notNull(),
  targetTable: text("target_table").notNull(),
  targetId: text("target_id").notNull(),
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLogEntry = typeof auditLog.$inferInsert;
export function notifications(notifications: any) {
  throw new Error("Function not implemented.");
}

