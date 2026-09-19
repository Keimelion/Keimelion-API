import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { addItemFromUrl } from '../lists.service.js'

const addItemFromUrlSchema = z.object({
  url: z.string().url(),
}).strict()

export type AddItemFromUrlInput = z.infer<typeof addItemFromUrlSchema>

export function mountAddItemFromUrl(router: FeatureRouter): void {
  router.post(
    '/:id/items/from-url',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', addItemFromUrlSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await addItemFromUrl(id, user.id, input))
    },
  )
}
