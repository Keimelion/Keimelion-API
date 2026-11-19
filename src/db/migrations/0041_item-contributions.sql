CREATE TYPE "public"."item_contribution_action" AS ENUM('fill', 'admin_update');--> statement-breakpoint
CREATE TABLE "item_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid,
	"action" "item_contribution_action" NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_contributions_changes_not_empty_check" CHECK ("item_contributions"."changes" <> '{}'::jsonb)
);
--> statement-breakpoint
ALTER TABLE "item_contributions" ADD CONSTRAINT "item_contributions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_contributions" ADD CONSTRAINT "item_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_contributions_item_id_created_at_idx" ON "item_contributions" USING btree ("item_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "item_contributions_user_id_idx" ON "item_contributions" USING btree ("user_id");