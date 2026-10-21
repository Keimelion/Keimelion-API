CREATE TYPE "locale" AS ENUM('fr', 'en');--> statement-breakpoint
CREATE TABLE "occasion_type_translations" (
	"occasion_type_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"label" varchar(100) NOT NULL,
	CONSTRAINT "occasion_type_translations_occasion_type_id_locale_pk" PRIMARY KEY("occasion_type_id","locale")
);--> statement-breakpoint
ALTER TABLE "occasion_type_translations"
  ADD CONSTRAINT "occasion_type_translations_occasion_type_id_occasion_types_id_fk"
  FOREIGN KEY ("occasion_type_id") REFERENCES "public"."occasion_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "occasion_type_translations" ("occasion_type_id", "locale", "label")
SELECT "id", 'fr', "label"
FROM "occasion_types";--> statement-breakpoint
UPDATE "occasion_types" SET "slug" = 'wedding' WHERE "slug" = 'mariage';--> statement-breakpoint
UPDATE "occasion_types" SET "slug" = 'birth' WHERE "slug" = 'naissance';--> statement-breakpoint
UPDATE "occasion_types" SET "slug" = 'birthday' WHERE "slug" = 'anniversaire';--> statement-breakpoint
UPDATE "occasion_types" SET "slug" = 'first-apartment' WHERE "slug" = 'premier-appartement';--> statement-breakpoint
UPDATE "occasion_types" SET "slug" = 'other' WHERE "slug" = 'autre';--> statement-breakpoint
ALTER TABLE "occasion_types" DROP COLUMN "label";
