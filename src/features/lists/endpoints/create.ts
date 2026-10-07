import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { createUserList } from '../lists.service.js'

const MAX_TITLE_LENGTH = 200

const createListSchema = z
  .object({
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    description: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === '' || value === undefined ? null : value)),
    occasionTypeId: z.string().uuid().optional(),
    eventDate: z.string().date().optional(),
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
