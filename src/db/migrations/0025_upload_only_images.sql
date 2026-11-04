CREATE INDEX "images_hash_idx" ON "images" USING btree ("hash");--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "image_url";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "avatar_url";