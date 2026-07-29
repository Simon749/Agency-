CREATE TYPE "public"."category" AS ENUM('RENT', 'WATER', 'ELECTRICITY', 'GARBAGE', 'SERVICE_CHARGE', 'WIFI', 'SECURITY', 'PREVIOUS_BALANCE', 'DEPOSIT');--> statement-breakpoint
CREATE TYPE "public"."complaint_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."complaint_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."lease_status" AS ENUM('ACTIVE', 'PENDING_RENEWAL', 'VACATED', 'TERMINATED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('MPESA_STK', 'BANK_RECEIPT', 'CASH', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('SUPER_ADMIN', 'AGENCY_OWNER', 'MANAGER', 'FIELD_AGENT', 'TENANT');--> statement-breakpoint
CREATE TYPE "public"."subscription_payment_method" AS ENUM('MPESA_PAYBILL', 'BANK_TRANSFER', 'CASH', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."subscription_payment_status" AS ENUM('PENDING', 'CONFIRMED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('TRIAL', 'STARTER', 'GROWTH', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'OVERDUE', 'SUSPENDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."termination_reason" AS ENUM('CONTRACT_ENDED', 'NON_PAYMENT', 'BREACH_OF_TERMS', 'REQUESTED_BY_AGENCY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"subscription_status" text DEFAULT 'TRIAL',
	"deleted_at" timestamp,
	"termination_reason" "termination_reason",
	"terminated_by" text,
	"data_exported_at" timestamp,
	"grace_period_ends_at" timestamp,
	"default_commission_rate" numeric(5, 2) DEFAULT '0.00',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agencies_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "agency_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"plan" "subscription_plan" DEFAULT 'TRIAL' NOT NULL,
	"amount_kes" numeric(10, 2) NOT NULL,
	"billing_cycle" text DEFAULT 'MONTHLY' NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"paid_through_date" date,
	"next_billing_date" date,
	"trial_ends_at" date,
	"payment_method" "subscription_payment_method" DEFAULT 'MPESA_PAYBILL',
	"mpesa_paybill_number" text,
	"mpesa_account_number" text,
	"bank_reference_prefix" text,
	"grace_period_days" numeric(3, 0) DEFAULT '7',
	"overdue_since" timestamp,
	"reminder_7_day_sent_at" timestamp,
	"reminder_1_day_sent_at" timestamp,
	"overdue_notice_sent_at" timestamp,
	"suspension_notice_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aggregator_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_reference" text NOT NULL,
	"aggregator_shortcode" text NOT NULL,
	"stk_push_reference" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aggregator_accounts_account_reference_unique" UNIQUE("account_reference")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_clerk_id" text NOT NULL,
	"actor_role" "role" NOT NULL,
	"agency_id" uuid,
	"action" text NOT NULL,
	"target_table" text NOT NULL,
	"target_id" text NOT NULL,
	"before_value" jsonb,
	"after_value" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"billing_month" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"total_tenants" integer DEFAULT 0,
	"processed_tenants" integer DEFAULT 0,
	"entries_inserted" integer DEFAULT 0,
	"entries_skipped" integer DEFAULT 0,
	"error_message" text,
	"error_details" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "building_utilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"name" "category" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"rate_type" text NOT NULL,
	"default_amount" numeric(10, 2) DEFAULT '0.00',
	"unit" text
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"locale" text,
	"landlord_name" text NOT NULL,
	"landlord_phone" text,
	"daraja_consumer_key" text,
	"daraja_consumer_secret" text,
	"daraja_shortcode" text,
	"daraja_passkey" text,
	"daraja_credentials_updated_at" timestamp,
	"payment_mode" text DEFAULT 'OWN_SHORTCODE' NOT NULL,
	"agreement_template" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaint_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"complaint_id" uuid NOT NULL,
	"author_clerk_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" "complaint_priority" DEFAULT 'MEDIUM' NOT NULL,
	"status" "complaint_status" DEFAULT 'OPEN' NOT NULL,
	"photo_urls" text[],
	"assigned_to" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"rent_amount" numeric(10, 2) NOT NULL,
	"deposit_amount" numeric(10, 2) NOT NULL,
	"deposit_paid" boolean DEFAULT false,
	"escalation_type" text DEFAULT 'FIXED',
	"escalation_value" numeric(5, 2),
	"agreement_template" text,
	"agreement_generated" text,
	"signed_at" timestamp,
	"signed_by_clerk_id" text,
	"status" "lease_status" DEFAULT 'ACTIVE' NOT NULL,
	"renewal_reminder_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"fallback_to_sms" boolean DEFAULT true NOT NULL,
	"whatsapp_phone" text,
	"channel_overrides" text,
	"preferred_channel" text DEFAULT 'SMS' NOT NULL,
	"notify_payment_received" boolean DEFAULT true NOT NULL,
	"notify_rent_reminder" boolean DEFAULT true NOT NULL,
	"notify_overdue" boolean DEFAULT true NOT NULL,
	"notify_lease_renewal" boolean DEFAULT true NOT NULL,
	"notify_complaint_filed" boolean DEFAULT true NOT NULL,
	"notify_complaint_resolved" boolean DEFAULT true NOT NULL,
	"notify_invite_sent" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_agency_id_unique" UNIQUE("agency_id")
);
--> statement-breakpoint
CREATE TABLE "pending_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"checkout_request_id" text NOT NULL,
	"merchant_request_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"phone" text NOT NULL,
	"status" "transaction_status" DEFAULT 'PENDING' NOT NULL,
	"mpesa_code" text,
	"result_code" text,
	"result_desc" text,
	"failure_reason" text,
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "pending_transactions_checkout_request_id_unique" UNIQUE("checkout_request_id"),
	CONSTRAINT "pending_transactions_mpesa_code_unique" UNIQUE("mpesa_code")
);
--> statement-breakpoint
CREATE TABLE "reconciliation_discrepancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"discrepancy_type" text NOT NULL,
	"daraja_transaction_id" text,
	"daraja_amount" numeric(10, 2),
	"daraja_phone" text,
	"daraja_timestamp" text,
	"ledger_entry_id" uuid,
	"ledger_reference_code" text,
	"ledger_amount" numeric(10, 2),
	"ledger_tenant_id" uuid,
	"amount" numeric(10, 2),
	"expected_amount" numeric(10, 2),
	"transaction_date" timestamp,
	"report_date" text,
	"reason" text,
	"status" text DEFAULT 'UNRESOLVED',
	"resolved_at" timestamp,
	"resolved_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"agency_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"role" "role" NOT NULL,
	"national_id" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"assigned_building_ids" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deactivated_at" timestamp,
	CONSTRAINT "staff_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "stk_push_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"phone" text NOT NULL,
	"account_reference" text NOT NULL,
	"transaction_desc" text,
	"shortcode_type" text DEFAULT 'OWN' NOT NULL,
	"aggregator_account_id" uuid,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"pending_transaction_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"subscription_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"method" "subscription_payment_method" NOT NULL,
	"status" "subscription_payment_status" DEFAULT 'PENDING' NOT NULL,
	"reference_code" text,
	"recorded_by" text,
	"receipt_url" text,
	"notes" text,
	"billing_period_start" date,
	"billing_period_end" date,
	"confirmed_at" timestamp,
	"confirmed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"type" "entry_type" NOT NULL,
	"category" "category" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" DEFAULT 'SYSTEM',
	"reference_code" text,
	"description" text NOT NULL,
	"billing_month" text,
	"recorded_by" text,
	"approval_status" text DEFAULT 'PENDING' NOT NULL,
	"is_reversal" boolean DEFAULT false NOT NULL,
	"reverses_entry_id" uuid,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_ledger_reference_code_unique" UNIQUE("reference_code")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text,
	"agency_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"national_id" text,
	"invite_status" text DEFAULT 'PENDING',
	"status" "lease_status" DEFAULT 'ACTIVE' NOT NULL,
	"vacated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"unit_number" text NOT NULL,
	"floor" text,
	"type" text,
	"rent_amount" numeric(10, 2) NOT NULL,
	"deposit_amount" numeric(10, 2) NOT NULL,
	"is_occupied" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utility_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"agent_clerk_id" text NOT NULL,
	"utility_type" "category" NOT NULL,
	"previous_reading" numeric(10, 2) NOT NULL,
	"current_reading" numeric(10, 2) NOT NULL,
	"units_consumed" numeric(10, 2) NOT NULL,
	"rate_per_unit" numeric(10, 2) NOT NULL,
	"total_charge" numeric(10, 2) NOT NULL,
	"billing_month" text NOT NULL,
	"ledger_entry_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregator_accounts" ADD CONSTRAINT "aggregator_accounts_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregator_accounts" ADD CONSTRAINT "aggregator_accounts_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregator_accounts" ADD CONSTRAINT "aggregator_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_utilities" ADD CONSTRAINT "building_utilities_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_updates" ADD CONSTRAINT "complaint_updates_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_transactions" ADD CONSTRAINT "pending_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stk_push_queue" ADD CONSTRAINT "stk_push_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_agency_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."agency_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_ledger" ADD CONSTRAINT "tenant_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_ledger" ADD CONSTRAINT "tenant_ledger_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_readings" ADD CONSTRAINT "utility_readings_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;