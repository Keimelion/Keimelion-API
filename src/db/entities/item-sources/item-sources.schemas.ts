import { z } from 'zod'
import { httpsUrlSchema } from '../../../shared/schemas/url.js'

const MAX_SOURCE_URL_LENGTH = 2048
const PRICE_REGEX = /^\d{1,8}(\.\d{1,2})?$/
const CURRENCY_REGEX = /^[A-Z]{3}$/
const CURRENCY_LENGTH = 3

export const DUPLICATE_SHOP_IN_SOURCES_MESSAGE =
  'This shop is already used by another source of this item.'

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

interface SourceWithShopId {
  shopId: string | null
}

/**
 * Reports a Zod validation issue on every source entry that shares a non-null
 * `shopId` with another entry in the same list. Sources with `shopId = null`
 * are intentionally skipped — the DB-level partial unique index does not
 * constrain them either (any number of null-shop sources is allowed per item).
 */
export function reportDuplicateSourceShopIds(
  sources: readonly SourceWithShopId[],
  ctx: z.RefinementCtx,
): void {
  const indicesByShopId = new Map<string, number[]>()
  sources.forEach((source, index) => {
    if (source.shopId === null) return
    const existing = indicesByShopId.get(source.shopId) ?? []
    existing.push(index)
    indicesByShopId.set(source.shopId, existing)
  })

  for (const indices of indicesByShopId.values()) {
    if (indices.length < 2) continue
    for (const index of indices) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sources', index, 'shopId'],
        message: DUPLICATE_SHOP_IN_SOURCES_MESSAGE,
      })
    }
  }
}
