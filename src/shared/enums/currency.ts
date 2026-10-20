/**
 * ISO 4217 currencies supported by the API for item source prices and
 * read-time FX normalization.
 *
 * The input schema (`currencySchema` in `item-sources.schemas.ts`) rejects any
 * code outside this set, so aggregated per-currency responses are always keyed
 * by one of these values.
 *
 * Keep in sync with the `currencies` table (see
 * `src/db/entities/currencies/currencies.schema.ts` and the seed in migration
 * `0013_add-currencies.sql`).
 */
export const SupportedCurrencies = {
  EUR: 'EUR',
  USD: 'USD',
  GBP: 'GBP',
  CHF: 'CHF',
  CAD: 'CAD',
  AUD: 'AUD',
  JPY: 'JPY',
} as const

export type SupportedCurrency = (typeof SupportedCurrencies)[keyof typeof SupportedCurrencies]

export const SUPPORTED_CURRENCY_VALUES = Object.values(SupportedCurrencies) as [
  SupportedCurrency,
  ...SupportedCurrency[],
]
