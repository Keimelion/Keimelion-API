import { z } from 'zod'

const MAX_SOURCE_URL_LENGTH = 2048
const PRICE_REGEX = /^\d{1,8}(\.\d{1,2})?$/
const CURRENCY_REGEX = /^[A-Z]{3}$/
const CURRENCY_LENGTH = 3

export const httpsSourceUrlSchema = z
  .string()
  .url()
  .max(MAX_SOURCE_URL_LENGTH)
  .refine((value) => value.startsWith('https://'), 'source_url must use HTTPS')
  .nullable()

export const priceSchema = z.string().regex(PRICE_REGEX).nullable()

export const currencySchema = z.string().length(CURRENCY_LENGTH).regex(CURRENCY_REGEX)

export const shopIdSchema = z.string().uuid().nullable()

export const itemSourceParamSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
})
