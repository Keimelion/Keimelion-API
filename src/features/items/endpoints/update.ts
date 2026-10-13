import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { getLocale } from '../../../shared/middlewares/resolve-locale.js'
import {
  MAX_TAGS_PER_RESOURCE,
  tagNameSchema,
} from '../../../db/entities/tags/tags.schemas.js'
import { MAX_CATEGORIES_PER_ITEM } from '../../../db/entities/item-categories/item-categories.schemas.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateUserItem } from '../items.service.js'

const updateItemSchema = z
  .object({
    tags: z
      .array(tagNameSchema)
      .max(
        MAX_TAGS_PER_RESOURCE,
        `tags must contain at most ${String(MAX_TAGS_PER_RESOURCE)} entries`,
      )
      .optional(),
    categories: z
      .array(z.string().uuid())
      .max(
        MAX_CATEGORIES_PER_ITEM,
        `categories must contain at most ${String(MAX_CATEGORIES_PER_ITEM)} entries`,
      )
      .optional(),
  })
  .strict()

export type UpdateItemInput = z.infer<typeof updateItemSchema>

export function mountUpdateItem(router: FeatureRouter): void {
  router.patch(
    '/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', updateItemSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      const locale = getLocale(context)
      return jsonResult(context, await updateUserItem(id, user.id, input, locale))
    },
  )
}
