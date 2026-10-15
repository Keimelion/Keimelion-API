import { zValidator } from '@hono/zod-validator'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { getLocale } from '../../../shared/middlewares/resolve-locale.js'
import { writableItemFieldsSchema } from '../items.schemas.js'
import type { z } from 'zod'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateUserItem } from '../items.service.js'

const updateItemSchema = writableItemFieldsSchema.partial().strict()

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
