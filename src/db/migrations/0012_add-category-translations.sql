BEGIN;

CREATE TABLE "category_translations" (
	"category_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"name" varchar(120) NOT NULL,
	CONSTRAINT "category_translations_category_id_locale_pk" PRIMARY KEY("category_id","locale")
);

ALTER TABLE "category_translations"
  ADD CONSTRAINT "category_translations_category_id_categories_id_fk"
  FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;

INSERT INTO "category_translations" ("category_id", "locale", "name")
SELECT "id", 'fr', "name"
FROM "categories";

UPDATE "categories" SET "slug" = 'electronics' WHERE "slug" = 'electronique';
UPDATE "categories" SET "slug" = 'fashion-accessories' WHERE "slug" = 'mode-accessoires';
UPDATE "categories" SET "slug" = 'home-decor' WHERE "slug" = 'maison-decoration';
UPDATE "categories" SET "slug" = 'books-media' WHERE "slug" = 'livres-medias';
UPDATE "categories" SET "slug" = 'sports-leisure' WHERE "slug" = 'sports-loisirs';
UPDATE "categories" SET "slug" = 'beauty-health' WHERE "slug" = 'beaute-sante';
UPDATE "categories" SET "slug" = 'toys-games' WHERE "slug" = 'jouets-jeux';
UPDATE "categories" SET "slug" = 'food-beverages' WHERE "slug" = 'alimentation-boissons';
UPDATE "categories" SET "slug" = 'travel' WHERE "slug" = 'voyage';
UPDATE "categories" SET "slug" = 'other' WHERE "slug" = 'autre';

ALTER TABLE "categories" DROP COLUMN "name";

COMMIT;
