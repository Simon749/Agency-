CREATE TABLE "users_mfa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text[] NOT NULL,
	"status" "mfa_status" DEFAULT 'PENDING' NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_mfa_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
