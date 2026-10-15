import { zValidator } from '@hono/zod-validator'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { getLocale } from '../../../shared/middlewares/resolve-locale.js'
import { writableItemFieldsSchema } from '../items.schemas.js'
import type { z } from 'zod'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { createUserItem } from '../items.service.js'

const createItemSchema = writableItemFieldsSchema
  .partial()
  .required({ name: true })
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
