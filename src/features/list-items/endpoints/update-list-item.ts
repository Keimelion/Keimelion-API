import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateListItemById } from '../list-items.service.js'

const MAX_CREATOR_NOTE_LENGTH = 1000
const MAX_QUANTITY = 100

const updateListItemSchema = z.object({
  quantityDesired: z.number().int().min(1).max(MAX_QUANTITY).optional(),
  creatorNote: z.string().max(MAX_CREATOR_NOTE_LENGTH).trim().nullable().optional(),
  sortOrder: z.number().int().optional(),
}).strict().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: 'At least one field must be provided' },
)

export type UpdateListItemInput = z.infer<typeof updateListItemSchema>

export function mountUpdateListItem(router: FeatureRouter): void {
  router.patch(
    '/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', updateListItemSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateListItemById(id, user.id, input))
    },
  )
}
