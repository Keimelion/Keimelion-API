import { zValidator } from '@hono/zod-validator'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { removeListItem } from '../list-items.service.js'

export function mountDeleteListItem(router: FeatureRouter): void {
  router.delete(
    '/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const { id } = context.req.valid('param')
      return jsonResult(context, await removeListItem(id, user.id))
    },
  )
}
