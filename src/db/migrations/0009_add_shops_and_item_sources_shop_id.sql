CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" varchar(120) NOT NULL,
	"domain" varchar(253),
	"logo_url" text,
	"is_affiliated" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "item_sources" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "shops_domain_unique_idx" ON "shops" USING btree ("domain") WHERE "shops"."domain" is not null;--> statement-breakpoint
CREATE INDEX "shops_sort_order_idx" ON "shops" USING btree ("sort_order");--> statement-breakpoint
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_sources_shop_id_idx" ON "item_sources" USING btree ("shop_id");