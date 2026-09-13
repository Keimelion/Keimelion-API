BEGIN;

CREATE TYPE "locale" AS ENUM('fr', 'en');

CREATE TABLE "occasion_type_translations" (
	"occasion_type_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"label" varchar(100) NOT NULL,
	CONSTRAINT "occasion_type_translations_occasion_type_id_locale_pk" PRIMARY KEY("occasion_type_id","locale")
);

ALTER TABLE "occasion_type_translations"
  ADD CONSTRAINT "occasion_type_translations_occasion_type_id_occasion_types_id_fk"
  FOREIGN KEY ("occasion_type_id") REFERENCES "public"."occasion_types"("id") ON DELETE cascade ON UPDATE no action;

INSERT INTO "occasion_type_translations" ("occasion_type_id", "locale", "label")
SELECT "id", 'fr', "label"
FROM "occasion_types";

ALTER TABLE "occasion_types" DROP COLUMN "label";

COMMIT;
