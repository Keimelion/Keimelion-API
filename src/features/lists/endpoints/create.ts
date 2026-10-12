import { zValidator } from '@hono/zod-validator'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { writableListFieldsSchema } from '../lists.schemas.js'
import type { z } from 'zod'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { createUserList } from '../lists.service.js'

const createListSchema = writableListFieldsSchema
  .partial()
  .required({ title: true })
  .strict()

export type CreateListInput = z.infer<typeof createListSchema>

export function mountCreateList(router: FeatureRouter): void {
  router.post(
    '/',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('json', createListSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createUserList(user, input))
    },
  )
}
