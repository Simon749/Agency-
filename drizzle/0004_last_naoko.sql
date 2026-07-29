ALTER TABLE "billing_runs" ADD COLUMN "failed_tenants" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "billing_runs" ADD COLUMN "qstash_message_id" text;--> statement-breakpoint
ALTER TABLE "billing_runs" ADD COLUMN "qstash_schedule_id" text;--> statement-breakpoint
ALTER TABLE "billing_runs" ADD COLUMN "error_log" jsonb DEFAULT '[]'::jsonb;