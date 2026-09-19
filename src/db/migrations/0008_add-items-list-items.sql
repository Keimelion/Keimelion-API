CREATE TYPE "public"."collab_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."list_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TABLE "item_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"shop_name" varchar(100),
	"source_url" text,
	"price" numeric(10, 2),
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"affiliate_partner" varchar(50),
	"affiliate_url" text,
	"is_domain_trusted" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"added_via" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" text,
	"image_url" text,
	"locale" char(5) DEFAULT 'fr' NOT NULL,
	"created_by_user_id" uuid,
	"moderation_status" varchar(20) DEFAULT 'approved' NOT NULL,
	"add_count" integer DEFAULT 0 NOT NULL,
	"reserve_count" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
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
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
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
	"slug" varchar(200) NOT NULL,
	"description" text,
	"event_date" timestamp,
	"list_status" "list_status" DEFAULT 'active' NOT NULL,
	"is_gallery_public" boolean DEFAULT false NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"template_source_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"import_count" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_collaborators" ADD CONSTRAINT "list_collaborators_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_collaborators" ADD CONSTRAINT "list_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_occasion_type_id_occasion_types_id_fk" FOREIGN KEY ("occasion_type_id") REFERENCES "public"."occasion_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "item_sources_primary_idx" ON "item_sources" USING btree ("item_id") WHERE "item_sources"."is_primary" = $1;