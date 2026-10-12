import { zValidator } from '@hono/zod-validator'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { getList, listOwnershipMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { assignTagsBodySchema } from '../../../db/entities/tags/tags.schemas.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { assignTagsToList } from '../lists.service.js'

export function mountAssignTags(router: FeatureRouter): void {
  router.post(
    '/:id/tags',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', assignTagsBodySchema, validationErrorHandler),
    listOwnershipMiddleware({ paramName: 'id' }),
    async (context) => {
      const user = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await assignTagsToList(getList(context), user.id, input.names))
    },
  )
}
