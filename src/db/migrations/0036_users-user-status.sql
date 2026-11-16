CREATE TYPE "public"."user_status" AS ENUM('pending_deletion', 'banned', 'invited', 'unverified', 'inactive', 'active');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "user_status" "user_status";--> statement-breakpoint
UPDATE "users" SET "user_status" = CASE
  WHEN "deleted_at" IS NOT NULL THEN 'pending_deletion'
  WHEN "banned_at" IS NOT NULL THEN 'banned'
  WHEN "activated_at" IS NULL THEN 'invited'
  WHEN "email_verified_at" IS NULL THEN 'unverified'
  WHEN COALESCE("last_active_at", "created_at") < now() - interval '12 months' THEN 'inactive'
  ELSE 'active'
END::"user_status";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "user_status" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "users_user_status_idx" ON "users" USING btree ("user_status");
