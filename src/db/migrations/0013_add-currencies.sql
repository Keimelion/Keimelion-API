CREATE TABLE "currencies" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"decimals" smallint DEFAULT 2 NOT NULL,
	"usd_rate" numeric(18, 8) NOT NULL,
	"usd_rate_as_of" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Seed every supported currency so read-time FX normalization works
-- out of the box. `usd_rate` is "units of this currency per 1 USD".
-- A follow-up ticket will refresh these daily from a provider.
INSERT INTO "currencies" ("code", "name", "symbol", "decimals", "usd_rate") VALUES
  ('USD', 'US Dollar',          '$',   2, 1.00000000),
  ('EUR', 'Euro',                '€',   2, 0.92000000),
  ('GBP', 'British Pound',       '£',   2, 0.79000000),
  ('CHF', 'Swiss Franc',         'CHF', 2, 0.88000000),
  ('CAD', 'Canadian Dollar',     'C$',  2, 1.37000000),
  ('AUD', 'Australian Dollar',   'A$',  2, 1.52000000),
  ('JPY', 'Japanese Yen',        '¥',   0, 149.50000000);
