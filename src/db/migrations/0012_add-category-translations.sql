CREATE TABLE "category_translations" (
	"category_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"name" varchar(120) NOT NULL,
	CONSTRAINT "category_translations_category_id_locale_pk" PRIMARY KEY("category_id","locale")
);--> statement-breakpoint
ALTER TABLE "category_translations"
  ADD CONSTRAINT "category_translations_category_id_categories_id_fk"
  FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "category_translations" ("category_id", "locale", "name")
SELECT "id", 'fr', "name"
FROM "categories";--> statement-breakpoint
UPDATE "categories" SET "slug" = 'electronics' WHERE "slug" = 'electronique';--> statement-breakpoint
UPDATE "categories" SET "slug" = 'fashion-accessories' WHERE "slug" = 'mode-accessoires';--> statement-breakpoint
UPDATE "categories" SET "slug" = 'home-decor' WHERE "slug" = 'maison-decoration';--> statement-breakpoint
UPDATE "categories" SET "slug" = 'books-media' WHERE "slug" = 'livres-medias';--> statement-breakpoint
UPDATE "categories" SET "slug" = 'sports-leisure' WHERE "slug" = 'sports-loisirs';--> statement-breakpoint
UPDATE "categories" SET "slug" = 'beauty-health' WHERE "slug" = 'beaute-sante';--> statement-breakpoint
UPDATE "categories" SET "slug" = 'toys-games' WHERE "slug" = 'jouets-jeux';--> statement-breakpoint
UPDATE "categories" SET "slug" = 'food-beverages' WHERE "slug" = 'alimentation-boissons';--> statement-breakpoint
UPDATE "categories" SET "slug" = 'travel' WHERE "slug" = 'voyage';--> statement-breakpoint
UPDATE "categories" SET "slug" = 'other' WHERE "slug" = 'autre';--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "name";
