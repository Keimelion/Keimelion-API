import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { listOwnershipMiddleware } from '../../../shared/middlewares/list-ownership.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { addItemToList } from '../lists.service.js'

const MAX_ITEM_NAME_LENGTH = 300
const MAX_CREATOR_NOTE_LENGTH = 1000
const MAX_QUANTITY = 100

const addItemSchema = z.object({
  name: z.string().min(1).max(MAX_ITEM_NAME_LENGTH).trim(),
  description: z.string().trim().optional(),
  imageUrl: z.string().url().optional(),
  price: z.number().positive().optional(),
  creatorNote: z.string().max(MAX_CREATOR_NOTE_LENGTH).trim().optional(),
  quantityDesired: z.number().int().min(1).max(MAX_QUANTITY).optional(),
}).strict()

export type AddItemInput = z.infer<typeof addItemSchema>

export function mountAddItem(router: FeatureRouter): void {
  router.post(
    '/:id/items',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', addItemSchema, validationErrorHandler),
    listOwnershipMiddleware({ paramName: 'id' }),
    async (context) => {
      const user = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await addItemToList(id, user.id, input))
    },
  )
}
