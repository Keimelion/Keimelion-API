ALTER TABLE "item_sources" ADD COLUMN "original_url" text;--> statement-breakpoint
ALTER TABLE "item_sources" ADD COLUMN "affiliate_url" text;--> statement-breakpoint
CREATE INDEX "item_sources_pending_affiliate_url_idx" ON "item_sources" USING btree ("shop_id","id") WHERE "item_sources"."affiliate_url" is null;--> statement-breakpoint
-- Sources stored before normalization kept the URL as submitted.
UPDATE "item_sources" SET "original_url" = "source_url" WHERE "original_url" IS NULL;
