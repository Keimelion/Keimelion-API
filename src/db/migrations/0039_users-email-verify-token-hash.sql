ALTER TABLE "users" ALTER COLUMN "email_verify_token" SET DATA TYPE text USING encode(sha256(convert_to("email_verify_token"::text, 'UTF8')), 'hex');
