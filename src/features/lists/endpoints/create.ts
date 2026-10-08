import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import {
  listTitleSchema,
  listDescriptionSchema,
  listOccasionTypeIdSchema,
} from '../../../db/entities/lists/lists.schemas.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { createUserList } from '../lists.service.js'

const createListSchema = z
  .object({
    title: listTitleSchema,
    description: listDescriptionSchema.optional(),
    occasionTypeId: listOccasionTypeIdSchema.optional(),
  })
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
