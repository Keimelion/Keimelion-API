import { char, numeric, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Supported ISO 4217 currencies with their display metadata and current
 * USD-pivot rate. `usd_rate` is "units of this currency per 1 USD"
 * (e.g. EUR.usd_rate = 0.92 means 1 USD = 0.92 EUR).
 *
 * Rows are seeded by the migration and must stay in sync with
 * `src/shared/enums/currency.ts` (`SupportedCurrencies`). A follow-up
 * ticket will refresh `usd_rate` + `usd_rate_as_of` daily from a
 * provider; another will add `users.default_currency_code` FK.
 */
export const currencies = pgTable('currencies', {
  code: char('code', { length: 3 }).primaryKey(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  decimals: smallint('decimals').notNull().default(2),
  usdRate: numeric('usd_rate', { precision: 18, scale: 8 }).notNull(),
  usdRateAsOf: timestamp('usd_rate_as_of', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export type Currency = typeof currencies.$inferSelect
