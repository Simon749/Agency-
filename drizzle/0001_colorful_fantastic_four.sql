ALTER TABLE "agencies" ADD COLUMN "invite_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "daraja_initiator_name" text;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "daraja_security_credential" text;