CREATE TABLE "currencies" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"decimals" smallint DEFAULT 2 NOT NULL,
	"usd_rate" numeric(18, 8) NOT NULL,
	"usd_rate_as_of" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "currencies" ("code", "name", "symbol", "decimals", "usd_rate") VALUES
  ('USD', 'US Dollar',          '$',   2, 1.00000000),
  ('EUR', 'Euro',                '€',   2, 0.92000000),
  ('GBP', 'British Pound',       '£',   2, 0.79000000),
  ('CHF', 'Swiss Franc',         'CHF', 2, 0.88000000),
  ('CAD', 'Canadian Dollar',     'C$',  2, 1.37000000),
  ('AUD', 'Australian Dollar',   'A$',  2, 1.52000000),
  ('JPY', 'Japanese Yen',        '¥',   0, 149.50000000);
--> statement-breakpoint
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;