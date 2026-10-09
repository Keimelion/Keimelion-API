import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { listOwnershipMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import {
  itemNameSchema,
  itemDescriptionSchema,
  itemImageUrlSchema,
} from '../../../db/entities/items/items.schemas.js'
import {
  creatorNoteSchema,
  quantityDesiredSchema,
} from '../../../db/entities/list-items/list-items.schemas.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { addItemToList } from '../lists.service.js'

const addItemSchema = z.object({
  name: itemNameSchema,
  description: itemDescriptionSchema.optional(),
  imageUrl: itemImageUrlSchema.optional(),
  price: z.number().positive().optional(),
  creatorNote: creatorNoteSchema.optional(),
  quantityDesired: quantityDesiredSchema.optional(),
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
