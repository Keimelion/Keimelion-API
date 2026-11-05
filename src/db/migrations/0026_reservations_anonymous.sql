ALTER TABLE "reservations" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "reserver_name" varchar(100);--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "reserver_email" varchar(254);--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "anonymous_token_hash" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_anonymous_token_hash_unique" ON "reservations" USING btree ("anonymous_token_hash");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_reserver_identity_check" CHECK ("reservations"."user_id" IS NOT NULL OR "reservations"."reserver_name" IS NOT NULL);