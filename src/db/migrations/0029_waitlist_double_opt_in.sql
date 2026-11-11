ALTER TABLE "waitlist_entries" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD COLUMN "confirmation_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD COLUMN "confirmation_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD COLUMN "confirmation_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD COLUMN "unsubscribe_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD COLUMN "launch_email_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "waitlist_entries_unconfirmed_expires_at_idx" ON "waitlist_entries" USING btree ("confirmation_token_expires_at") WHERE "waitlist_entries"."confirmed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "waitlist_entries_launch_email_sent_at_idx" ON "waitlist_entries" USING btree ("launch_email_sent_at") WHERE "waitlist_entries"."launch_email_sent_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_confirmation_token_hash_unique" UNIQUE("confirmation_token_hash");--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_unsubscribe_token_hash_unique" UNIQUE("unsubscribe_token_hash");--> statement-breakpoint
-- Signups stored before double opt-in are treated as confirmed: they receive no confirmation email.
UPDATE "waitlist_entries" SET "confirmed_at" = "consent_given_at" WHERE "confirmed_at" IS NULL;
