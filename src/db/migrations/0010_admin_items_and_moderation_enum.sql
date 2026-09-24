-- Rollback:
--   DROP INDEX IF EXISTS items_moderation_status_idx;
--   ALTER TABLE "items" ALTER COLUMN "moderation_status" DROP DEFAULT;
--   ALTER TABLE "items" ALTER COLUMN "moderation_status" SET DATA TYPE varchar(20) USING "moderation_status"::varchar;
--   ALTER TABLE "items" ALTER COLUMN "moderation_status" SET DEFAULT 'approved';
--   DROP TYPE IF EXISTS "public"."moderation_status_enum";

CREATE TYPE "public"."moderation_status_enum" AS ENUM('approved', 'pending', 'rejected');--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "moderation_status" DROP DEFAULT;--> statement-breakpoint
UPDATE "items" SET "moderation_status" = 'approved' WHERE "moderation_status" NOT IN ('approved', 'pending', 'rejected');--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "moderation_status" SET DATA TYPE "public"."moderation_status_enum" USING "moderation_status"::"public"."moderation_status_enum";--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "moderation_status" SET DEFAULT 'approved'::"public"."moderation_status_enum";--> statement-breakpoint
CREATE INDEX "items_moderation_status_idx" ON "items" USING btree ("moderation_status") WHERE "items"."moderation_status" <> 'approved';
