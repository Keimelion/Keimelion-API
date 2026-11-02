CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'declined', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('available', 'reserved', 'purchased');--> statement-breakpoint
CREATE TYPE "public"."deletion_reason" AS ENUM('soft_delete_grace', 'inactive_24mo', 'user_request');--> statement-breakpoint
ALTER TABLE "list_collaborators" ALTER COLUMN "invite_status" SET DEFAULT 'pending'::"public"."invite_status";--> statement-breakpoint
ALTER TABLE "list_collaborators" ALTER COLUMN "invite_status" SET DATA TYPE "public"."invite_status" USING "invite_status"::"public"."invite_status";--> statement-breakpoint
ALTER TABLE "list_items" ALTER COLUMN "item_status" SET DEFAULT 'available'::"public"."item_status";--> statement-breakpoint
ALTER TABLE "list_items" ALTER COLUMN "item_status" SET DATA TYPE "public"."item_status" USING "item_status"::"public"."item_status";--> statement-breakpoint
ALTER TABLE "user_deletion_audit" ALTER COLUMN "reason" SET DATA TYPE "public"."deletion_reason" USING "reason"::"public"."deletion_reason";