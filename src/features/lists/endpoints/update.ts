import { zValidator } from '@hono/zod-validator'
import { listsUpdateRequestSchema } from '@keimelion/sdk/schemas'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { getList, listContributorMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateUserList } from '../lists.service.js'

export function mountUpdateUserList(router: FeatureRouter): void {
  router.patch(
    '/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', listsUpdateRequestSchema, validationErrorHandler),
    listContributorMiddleware({ paramName: 'id' }),
    async (context) => {
      const user = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await updateUserList(getList(context), user.id, input))
    },
  )
}
