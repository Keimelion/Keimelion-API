CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"quantity_booked" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_list_item_id_user_id_unique" UNIQUE("list_item_id","user_id"),
	CONSTRAINT "quantity_booked_positive_check" CHECK ("reservations"."quantity_booked" >= 1)
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_list_item_id_list_items_id_fk" FOREIGN KEY ("list_item_id") REFERENCES "public"."list_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservations_user_id_idx" ON "reservations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reservations_list_item_id_idx" ON "reservations" USING btree ("list_item_id");