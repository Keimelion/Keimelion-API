import { zValidator } from '@hono/zod-validator'
import { collaboratorsCreateInviteRequestSchema } from '@keimelion/sdk/schemas'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../../shared/middlewares/auth.js'
import { getList, listOwnershipMiddleware } from '../../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createListInvite } from '../../collaborators.service.js'

export function mountCreateInvite(router: FeatureRouter): void {
  router.post(
    '/:id/collaborators/invites',
    authMiddleware,
    RATE_LIMITS.SENSITIVE(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', collaboratorsCreateInviteRequestSchema, validationErrorHandler),
    listOwnershipMiddleware({ paramName: 'id' }),
    async (context) => {
      const user = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createListInvite(getList(context), user, input))
    },
  )
}
