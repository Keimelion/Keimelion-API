import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import {
  itemNameSchema,
  itemDescriptionSchema,
  itemImageUrlSchema,
} from '../../../../db/entities/items/items.schemas.js'
import { itemCategoriesInputSchema } from '../../../../db/entities/item-categories/item-categories.schemas.js'
import {
  MAX_TAGS_PER_RESOURCE,
  tagNameSchema,
} from '../../../../db/entities/tags/tags.schemas.js'
import { getLocale } from '../../../../shared/middlewares/resolve-locale.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateItemById } from '../admin-items.service.js'

const adminUpdateItemSchema = z
  .object({
    name: itemNameSchema.optional(),
    description: itemDescriptionSchema.optional(),
    imageUrl: itemImageUrlSchema.optional(),
    categories: itemCategoriesInputSchema,
    tags: z
      .array(tagNameSchema)
      .max(
        MAX_TAGS_PER_RESOURCE,
        `tags must contain at most ${String(MAX_TAGS_PER_RESOURCE)} entries`,
      )
      .optional(),
  })
  .strict()

export type UpdateItemInput = z.infer<typeof adminUpdateItemSchema>

export function mountUpdateItem(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminUpdateItemSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      const locale = getLocale(context)
      return jsonResult(context, await updateItemById(admin.id, id, input, locale))
    },
  )
}
