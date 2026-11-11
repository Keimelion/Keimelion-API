CREATE TYPE "public"."report_reason" AS ENUM('harassment', 'hate_violence', 'sexual_content', 'scam_fraud', 'spam', 'illegal_content', 'privacy', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'upheld', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target_type" AS ENUM('user', 'list', 'item');--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"target_type" "report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"target_snapshot" jsonb NOT NULL,
	"target_image_id" uuid,
	"reason" "report_reason" NOT NULL,
	"description" text,
	"report_status" "report_status" DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_description_length_check" CHECK (char_length("reports"."description") <= 1000),
	CONSTRAINT "reports_admin_note_length_check" CHECK (char_length("reports"."admin_note") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_image_id_images_id_fk" FOREIGN KEY ("target_image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_report_status_created_at_idx" ON "reports" USING btree ("report_status","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_type_target_id_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_user_id_idx" ON "reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_target_image_id_idx" ON "reports" USING btree ("target_image_id");