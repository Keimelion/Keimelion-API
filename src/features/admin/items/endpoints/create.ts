import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { multipartOnly, RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { itemNameSchema, itemDescriptionSchema } from '../../../../db/entities/items/items.schemas.js'
import {
  currencySchema,
  httpsSourceUrlSchema,
  priceSchema,
  reportDuplicateSourceShopIds,
  shopIdSchema,
} from '../../../../db/entities/item-sources/item-sources.schemas.js'
import { itemCategoriesInputSchema } from '../../../../db/entities/item-categories/item-categories.schemas.js'
import { itemTagsInputSchema } from '../../../../db/entities/item-tags/item-tags.schemas.js'
import { getLocale } from '../../../../shared/middlewares/resolve-locale.js'
import { multipartJsonSchema, parseJsonOrMultipart, sendParseFailure } from '../../../uploads/multipart.js'
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

const createItemSourcesSchema = z.array(createItemSourceInputSchema).min(1)

const adminCreateItemScalarFields = {
  name: itemNameSchema,
  description: itemDescriptionSchema.optional().transform((value) => value ?? null),
}

const jsonAdminCreateItemSchema = z
  .object({
    ...adminCreateItemScalarFields,
    sources: createItemSourcesSchema,
    categories: itemCategoriesInputSchema,
    tags: itemTagsInputSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    reportDuplicateSourceShopIds(value.sources, ctx)
  })

const multipartAdminCreateItemSchema = z
  .object({
    ...adminCreateItemScalarFields,
    sources: multipartJsonSchema(createItemSourcesSchema),
    categories: multipartJsonSchema(itemCategoriesInputSchema).optional(),
    tags: multipartJsonSchema(itemTagsInputSchema).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    reportDuplicateSourceShopIds(value.sources, ctx)
  })

export type CreateItemFields = z.infer<typeof jsonAdminCreateItemSchema>

export function mountCreateItem(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    multipartOnly(RATE_LIMITS.UPLOAD()),
    async (context) => {
      const parsed = await parseJsonOrMultipart(context, {
        jsonSchema: jsonAdminCreateItemSchema,
        multipartSchema: multipartAdminCreateItemSchema,
      })
      if (!parsed.ok) return sendParseFailure(parsed)

      const admin = getAuthUser(context)
      const locale = getLocale(context)
      const input = { ...parsed.data, imageBuffer: parsed.imageBuffer }
      return jsonResult(context, await createItem(admin.id, input, locale))
    },
  )
}
