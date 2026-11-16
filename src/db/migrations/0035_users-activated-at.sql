ALTER TABLE "users" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users" SET "activated_at" = "created_at";
