import { z } from 'zod'
import {
  SUPPORTED_CURRENCY_VALUES,
  SupportedCurrencies,
  type SupportedCurrency,
} from '../enums/currency.js'

/**
 * Default display currency used when `?currency=` is omitted on endpoints
 * that normalize monetary values via the `currencies` table at read time.
 */
export const DEFAULT_DISPLAY_CURRENCY: SupportedCurrency = SupportedCurrencies.USD

/**
 * Base Zod enum for a single supported currency code. Shared between the
 * `item_sources.currency` input validator and the FX-normalized endpoints'
 * `?currency=` query validator so the error message stays in one place.
 */
export const supportedCurrencyEnum = z.enum(SUPPORTED_CURRENCY_VALUES, {
  errorMap: () => ({
    message: `currency must be one of: ${SUPPORTED_CURRENCY_VALUES.join(', ')}`,
  }),
})

/**
 * Query parameter schema accepted by endpoints that return FX-normalized
 * amounts (e.g. `GET /v1/admin/lists?currency=EUR`).
 *
 * The field is optional. Resolution order at the endpoint boundary:
 *   1. `?currency=` when explicitly provided (always wins)
 *   2. The authenticated user's `default_currency_code`
 *   3. `DEFAULT_DISPLAY_CURRENCY` as a last-resort fallback
 */
export const displayCurrencyQuerySchema = z.object({
  currency: supportedCurrencyEnum.optional(),
})
