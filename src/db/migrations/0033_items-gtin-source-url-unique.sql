ALTER TABLE "items" ADD COLUMN "gtin" char(14);--> statement-breakpoint
-- Sources sharing a URL keep it on the oldest one only. The others keep their shop, price and
-- original_url, so the item merge tickets can still reconcile them.
UPDATE "item_sources" SET "source_url" = NULL, "affiliate_url" = NULL
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (PARTITION BY "source_url" ORDER BY "created_at", "id") AS "rank"
    FROM "item_sources"
    WHERE "source_url" IS NOT NULL
  ) AS "ranked_sources"
  WHERE "rank" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "item_sources_source_url_hash_unique_idx" ON "item_sources" USING btree (md5("source_url")) WHERE "item_sources"."source_url" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "items_gtin_unique_idx" ON "items" USING btree ("gtin") WHERE "items"."gtin" is not null;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "gtin_digits_check" CHECK ("items"."gtin" ~ '^[0-9]{14}$');
