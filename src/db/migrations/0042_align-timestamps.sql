ALTER TABLE "category_translations" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "category_translations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "currencies" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "currencies" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "item_categories" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "item_categories" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "item_tags" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "item_tags" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "list_tags" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "list_tags" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "occasion_type_translations" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "occasion_type_translations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "item_categories" SET "created_at" = "assigned_at", "updated_at" = "assigned_at";--> statement-breakpoint
UPDATE "item_tags" SET "created_at" = "assigned_at", "updated_at" = "assigned_at";--> statement-breakpoint
UPDATE "list_tags" SET "created_at" = "assigned_at", "updated_at" = "assigned_at";--> statement-breakpoint
UPDATE "currencies" SET "created_at" = "usd_rate_as_of", "updated_at" = "usd_rate_as_of";--> statement-breakpoint
UPDATE "reservations" SET "updated_at" = "created_at";--> statement-breakpoint
UPDATE "refresh_tokens" SET "updated_at" = COALESCE("revoked_at", "created_at");--> statement-breakpoint
UPDATE "category_translations" SET "created_at" = "categories"."created_at", "updated_at" = "categories"."updated_at"
FROM "categories" WHERE "categories"."id" = "category_translations"."category_id";--> statement-breakpoint
UPDATE "occasion_type_translations" SET "created_at" = "occasion_types"."created_at", "updated_at" = "occasion_types"."updated_at"
FROM "occasion_types" WHERE "occasion_types"."id" = "occasion_type_translations"."occasion_type_id";--> statement-breakpoint
ALTER TABLE "item_categories" DROP COLUMN "assigned_at";--> statement-breakpoint
ALTER TABLE "item_tags" DROP COLUMN "assigned_at";--> statement-breakpoint
ALTER TABLE "list_tags" DROP COLUMN "assigned_at";
