ALTER TABLE "item_sources" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "item_sources" SET "created_by_user_id" = "items"."created_by_user_id"
FROM "items"
WHERE "items"."id" = "item_sources"."item_id" AND "items"."created_by_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "item_sources_created_by_user_id_idx" ON "item_sources" USING btree ("created_by_user_id");