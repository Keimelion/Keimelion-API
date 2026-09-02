ALTER TABLE "users" ADD COLUMN "password_reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_token_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "users_password_reset_token_idx" ON "users" USING btree ("password_reset_token");