ALTER TABLE "categories" ADD CONSTRAINT "slug_slug_check" CHECK ("categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "depth_non_negative_check" CHECK ("categories"."depth" >= 0);--> statement-breakpoint
ALTER TABLE "category_translations" ADD CONSTRAINT "name_non_empty_check" CHECK (char_length("category_translations"."name") >= 1);--> statement-breakpoint
ALTER TABLE "currencies" ADD CONSTRAINT "decimals_non_negative_check" CHECK ("currencies"."decimals" >= 0);--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "title_non_empty_check" CHECK (char_length("feedback"."title") >= 1);--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "size_bytes_non_negative_check" CHECK ("images"."size_bytes" >= 0);--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "width_non_negative_check" CHECK ("images"."width" >= 0);--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "height_non_negative_check" CHECK ("images"."height" >= 0);--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "name_non_empty_check" CHECK (char_length("items"."name") >= 1);--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "quantity_desired_non_negative_check" CHECK ("list_items"."quantity_desired" >= 0);--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "quantity_reserved_total_non_negative_check" CHECK ("list_items"."quantity_reserved_total" >= 0);--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "sort_order_non_negative_check" CHECK ("list_items"."sort_order" IS NULL OR "list_items"."sort_order" >= 0);--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "title_non_empty_check" CHECK (char_length("lists"."title") >= 1);--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "slug_slug_check" CHECK ("lists"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "occasion_type_translations" ADD CONSTRAINT "label_non_empty_check" CHECK (char_length("occasion_type_translations"."label") >= 1);--> statement-breakpoint
ALTER TABLE "occasion_types" ADD CONSTRAINT "slug_slug_check" CHECK ("occasion_types"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "occasion_types" ADD CONSTRAINT "sort_order_non_negative_check" CHECK ("occasion_types"."sort_order" >= 0);--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "slug_slug_check" CHECK ("shops"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "name_non_empty_check" CHECK (char_length("shops"."name") >= 1);--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "sort_order_non_negative_check" CHECK ("shops"."sort_order" >= 0);--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "name_non_empty_check" CHECK (char_length("tags"."name") >= 1);--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "slug_slug_check" CHECK ("tags"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "user_deletion_audit" ADD CONSTRAINT "email_non_empty_check" CHECK (char_length("user_deletion_audit"."email") >= 1);