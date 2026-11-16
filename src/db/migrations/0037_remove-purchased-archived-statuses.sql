UPDATE "list_items" SET "item_status" = CASE
	WHEN COALESCE(
		(SELECT SUM("reservations"."quantity_booked") FROM "reservations" WHERE "reservations"."list_item_id" = "list_items"."id"),
		0
	) >= "list_items"."quantity_desired" THEN 'reserved'::"public"."item_status"
	ELSE 'available'::"public"."item_status"
END
WHERE "item_status" = 'purchased';--> statement-breakpoint
UPDATE "lists" SET "list_status" = 'active' WHERE "list_status" = 'archived';--> statement-breakpoint
ALTER TABLE "list_items" ALTER COLUMN "item_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "list_items" ALTER COLUMN "item_status" SET DEFAULT 'available'::text;--> statement-breakpoint
DROP TYPE "public"."item_status";--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('available', 'reserved');--> statement-breakpoint
ALTER TABLE "list_items" ALTER COLUMN "item_status" SET DEFAULT 'available'::"public"."item_status";--> statement-breakpoint
ALTER TABLE "list_items" ALTER COLUMN "item_status" SET DATA TYPE "public"."item_status" USING "item_status"::"public"."item_status";--> statement-breakpoint
ALTER TABLE "lists" ALTER COLUMN "list_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "lists" ALTER COLUMN "list_status" SET DEFAULT 'active'::text;--> statement-breakpoint
DROP TYPE "public"."list_status";--> statement-breakpoint
CREATE TYPE "public"."list_status" AS ENUM('active', 'deleted');--> statement-breakpoint
ALTER TABLE "lists" ALTER COLUMN "list_status" SET DEFAULT 'active'::"public"."list_status";--> statement-breakpoint
ALTER TABLE "lists" ALTER COLUMN "list_status" SET DATA TYPE "public"."list_status" USING "list_status"::"public"."list_status";