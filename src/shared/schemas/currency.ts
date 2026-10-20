import { z } from 'zod'
import {
  SUPPORTED_CURRENCY_VALUES,
  SupportedCurrencies,
  type SupportedCurrency,
} from '../enums/currency.js'

/**
 * Default display currency used when `?currency=` is omitted on endpoints
 * that normalize monetary values via `fx_rates` at read time.
 */
export const DEFAULT_DISPLAY_CURRENCY: SupportedCurrency = SupportedCurrencies.USD

/**
 * Query parameter schema accepted by endpoints that return FX-normalized
 * amounts (e.g. `GET /v1/admin/lists?currency=EUR`). Rejects any ISO code
 * outside `SUPPORTED_CURRENCY_VALUES` with a 422, defaults to USD.
 */
export const displayCurrencyQuerySchema = z.object({
  currency: z
    .enum(SUPPORTED_CURRENCY_VALUES, {
      errorMap: () => ({
        message: `currency must be one of: ${SUPPORTED_CURRENCY_VALUES.join(', ')}`,
      }),
    })
    .default(DEFAULT_DISPLAY_CURRENCY),
})

export type DisplayCurrencyQueryInput = z.infer<typeof displayCurrencyQuerySchema>
