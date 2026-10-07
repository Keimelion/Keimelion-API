ALTER TABLE "lists" ADD COLUMN "slug" varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "event_date" date;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "is_gallery_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_slug_unique" UNIQUE("slug");