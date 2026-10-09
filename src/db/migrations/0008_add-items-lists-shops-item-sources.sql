CREATE TYPE "public"."collab_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."list_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TABLE "item_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"shop_id" uuid,
	"source_url" text,
	"price" numeric(10, 2),
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" text,
	"image_url" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"user_id" uuid,
	"invited_email" varchar(255),
	"collab_role" "collab_role" DEFAULT 'editor' NOT NULL,
	"invite_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"invite_token" uuid,
	"invite_token_expires_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_collaborators_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity_desired" smallint DEFAULT 1 NOT NULL,
	"quantity_reserved_total" smallint DEFAULT 0 NOT NULL,
	"item_status" varchar(20) DEFAULT 'available' NOT NULL,
	"sort_order" integer,
	"creator_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_items_list_id_item_id_unique" UNIQUE("list_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_type_id" uuid,
	"title" varchar(200) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"description" text,
	"list_status" "list_status" DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
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
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_collaborators" ADD CONSTRAINT "list_collaborators_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_collaborators" ADD CONSTRAINT "list_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_occasion_type_id_occasion_types_id_fk" FOREIGN KEY ("occasion_type_id") REFERENCES "public"."occasion_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_sources_shop_id_idx" ON "item_sources" USING btree ("shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_sources_item_shop_unique_idx" ON "item_sources" USING btree ("item_id","shop_id") WHERE "item_sources"."shop_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "shops_domain_unique_idx" ON "shops" USING btree ("domain") WHERE "shops"."domain" is not null;--> statement-breakpoint
CREATE INDEX "shops_sort_order_idx" ON "shops" USING btree ("sort_order");