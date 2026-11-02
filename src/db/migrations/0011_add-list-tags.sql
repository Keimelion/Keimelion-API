CREATE TABLE "list_tags" (
	"list_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_tags_list_id_tag_id_pk" PRIMARY KEY("list_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "list_tags" ADD CONSTRAINT "list_tags_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_tags" ADD CONSTRAINT "list_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "list_tags_tag_id_idx" ON "list_tags" USING btree ("tag_id");