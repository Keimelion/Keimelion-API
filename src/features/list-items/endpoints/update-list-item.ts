import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { listContributorMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import {
  creatorNoteSchema,
  quantityDesiredSchema,
} from '../../../db/entities/list-items/list-items.schemas.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { findListItemById } from '../../../db/entities/list-items/list-items.repository.js'
import { updateListItemById } from '../list-items.service.js'

const updateListItemSchema = z.object({
  quantityDesired: quantityDesiredSchema.optional(),
  creatorNote: creatorNoteSchema.optional(),
  sortOrder: z.number().int().optional(),
}).strict()

export function mountUpdateListItem(router: FeatureRouter): void {
  router.patch(
    '/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', updateListItemSchema, validationErrorHandler),
    listContributorMiddleware({
      paramName: 'id',
      resolveListId: async (context) => {
        const listItemId = context.req.param('id')
        if (!listItemId) return null
        const listItem = await findListItemById(listItemId)
        return listItem?.listId ?? null
      },
    }),
    async (context) => {
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateListItemById(id, input))
    },
  )
}
