import { zValidator } from '@hono/zod-validator'
import { listsAddItemRequestSchema } from '@keimelion/sdk/schemas'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { listContributorMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { addItemToList } from '../lists.service.js'

export function mountAddItem(router: FeatureRouter): void {
  router.post(
    '/:id/items',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', listsAddItemRequestSchema, validationErrorHandler),
    listContributorMiddleware({ paramName: 'id' }),
    async (context) => {
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await addItemToList(id, input))
    },
  )
}
