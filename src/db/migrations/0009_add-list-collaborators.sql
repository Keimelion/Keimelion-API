CREATE TYPE "public"."collab_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
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
ALTER TABLE "list_collaborators" ADD CONSTRAINT "list_collaborators_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_collaborators" ADD CONSTRAINT "list_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;