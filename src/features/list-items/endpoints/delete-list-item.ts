import { zValidator } from '@hono/zod-validator'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { listOwnershipMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { findListItemById } from '../../../db/entities/list-items/list-items.repository.js'
import { removeListItem } from '../list-items.service.js'

export function mountDeleteListItem(router: FeatureRouter): void {
  router.delete(
    '/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    listOwnershipMiddleware({
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
      return jsonResult(context, await removeListItem(id))
    },
  )
}
