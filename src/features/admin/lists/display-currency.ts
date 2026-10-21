import type { SupportedCurrency } from '../../../shared/enums/currency.js'
import type { User } from '../../../db/entities/users/users.schema.js'

/**
 * Resolves the display currency to apply on an FX-normalized admin endpoint.
 *
 * Resolution order (first match wins):
 *   1. Explicit `?currency=` query parameter (user override)
 *   2. The authenticated caller's `default_currency_code` preference
 *      (DB-level default is `'USD'`, so this is always a supported code)
 */
export function resolveDisplayCurrency(
  queryCurrency: SupportedCurrency | undefined,
  user: User,
): SupportedCurrency {
  return queryCurrency ?? (user.defaultCurrencyCode as SupportedCurrency)
}
