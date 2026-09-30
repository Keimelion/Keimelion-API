DROP INDEX "items_moderation_status_idx";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "moderation_status";--> statement-breakpoint
DROP TYPE "public"."moderation_status_enum";