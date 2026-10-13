import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { getLocale } from '../../../shared/middlewares/resolve-locale.js'
import {
  itemDescriptionSchema,
  itemImageUrlSchema,
  itemNameSchema,
} from '../../../db/entities/items/items.schemas.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { createUserItem } from '../items.service.js'

const createItemSchema = z
  .object({
    name: itemNameSchema,
    description: itemDescriptionSchema.optional(),
    imageUrl: itemImageUrlSchema.optional(),
  })
  .strict()

export type CreateItemInput = z.infer<typeof createItemSchema>

export function mountCreateItem(router: FeatureRouter): void {
  router.post(
    '/',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('json', createItemSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const input = context.req.valid('json')
      const locale = getLocale(context)
      return jsonResult(context, await createUserItem(user.id, input, locale))
    },
  )
}
