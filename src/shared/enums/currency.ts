/**
 * ISO 4217 currencies supported by the API for item source prices.
 *
 * The input schema (`currencySchema` in `item-sources.schemas.ts`) rejects any
 * code outside this set, so aggregated per-currency responses are always keyed
 * by one of these values.
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

const SUPPORTED_CURRENCY_SET: ReadonlySet<string> = new Set(SUPPORTED_CURRENCY_VALUES)

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return SUPPORTED_CURRENCY_SET.has(value)
}
