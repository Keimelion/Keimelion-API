CREATE TYPE "public"."list_user_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "list_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"invited_by_user_id" uuid,
	"invited_email" varchar(255) NOT NULL,
	"role" "list_user_role" DEFAULT 'editor' NOT NULL,
	"invite_token" varchar(64) NOT NULL,
	"invite_token_expires_at" timestamp with time zone NOT NULL,
	"invite_status" "invite_status" DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_invites_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "list_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "list_user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "list_collaborators" CASCADE;--> statement-breakpoint
ALTER TABLE "list_invites" ADD CONSTRAINT "list_invites_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_invites" ADD CONSTRAINT "list_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_invites" ADD CONSTRAINT "list_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_users" ADD CONSTRAINT "list_users_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_users" ADD CONSTRAINT "list_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_list_invites_pending_per_list" ON "list_invites" USING btree ("list_id") WHERE "list_invites"."invite_status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_list_invites_list_status" ON "list_invites" USING btree ("list_id","invite_status");--> statement-breakpoint
CREATE INDEX "idx_list_invites_invited_email" ON "list_invites" USING btree ("invited_email");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_list_users_list_user" ON "list_users" USING btree ("list_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_list_users_active_editor" ON "list_users" USING btree ("list_id") WHERE "list_users"."role" = 'editor';--> statement-breakpoint
CREATE INDEX "idx_list_users_user_role" ON "list_users" USING btree ("user_id","role");--> statement-breakpoint
CREATE INDEX "idx_list_users_list_role" ON "list_users" USING btree ("list_id","role");--> statement-breakpoint
DROP TYPE "public"."collab_role";