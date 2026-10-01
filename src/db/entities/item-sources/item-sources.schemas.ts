import { z } from 'zod'
import { httpsUrlSchema } from '../../../shared/schemas/url.js'

const MAX_SOURCE_URL_LENGTH = 2048
const PRICE_REGEX = /^\d{1,8}(\.\d{1,2})?$/
const CURRENCY_REGEX = /^[A-Z]{3}$/
const CURRENCY_LENGTH = 3

export const httpsSourceUrlSchema = httpsUrlSchema('sourceUrl', MAX_SOURCE_URL_LENGTH).nullable()

export const priceSchema = z
  .string()
  .regex(
    PRICE_REGEX,
    'price must be a decimal with up to 8 digits before the dot and 2 after (e.g. 19.99)',
  )
  .nullable()

export const currencySchema = z
  .string()
  .length(CURRENCY_LENGTH, `currency must be exactly ${String(CURRENCY_LENGTH)} characters`)
  .regex(CURRENCY_REGEX, 'currency must be a 3-letter uppercase ISO code (e.g. EUR)')

export const shopIdSchema = z.string().uuid().nullable()

export const itemSourceParamSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
})
