ALTER TABLE "list_items" ADD COLUMN "custom_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "custom_url_non_empty_check" CHECK (char_length("list_items"."custom_url") >= 1);--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "custom_url_https_check" CHECK ("list_items"."custom_url" LIKE 'https://%');