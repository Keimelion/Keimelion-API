CREATE TYPE "public"."auth_provider" AS ENUM('email', 'google');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"password_hash" text,
	"auth_provider" "auth_provider" NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_cgv_accepted" boolean DEFAULT false NOT NULL,
	"cgv_accepted_at" timestamp with time zone,
	"is_marketing_opted_in" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"banned_at" timestamp with time zone,
	"ban_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
