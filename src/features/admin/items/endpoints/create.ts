import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import {
  itemNameSchema,
  itemDescriptionSchema,
  itemImageUrlSchema,
} from '../../../../db/entities/items/items.schemas.js'
import {
  currencySchema,
  httpsSourceUrlSchema,
  priceSchema,
  reportDuplicateSourceShopIds,
  shopIdSchema,
} from '../../../../db/entities/item-sources/item-sources.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createItem } from '../admin-items.service.js'

const createItemSourceInputSchema = z
  .object({
    shopId: shopIdSchema.optional().transform((value) => value ?? null),
    sourceUrl: httpsSourceUrlSchema.optional().transform((value) => value ?? null),
    price: priceSchema.optional().transform((value) => value ?? null),
    currency: currencySchema.default('EUR'),
  })
  .strict()

const adminCreateItemSchema = z
  .object({
    name: itemNameSchema,
    description: itemDescriptionSchema.optional().transform((value) => value ?? null),
    imageUrl: itemImageUrlSchema.optional().transform((value) => value ?? null),
    sources: z.array(createItemSourceInputSchema).min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    reportDuplicateSourceShopIds(value.sources, ctx)
  })

export type CreateItemInput = z.infer<typeof adminCreateItemSchema>
export type CreateItemSourceEntry = z.infer<typeof createItemSourceInputSchema>

export function mountCreateItem(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('json', adminCreateItemSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createItem(admin.id, input))
    },
  )
}
