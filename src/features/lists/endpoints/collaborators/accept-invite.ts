import { zValidator } from '@hono/zod-validator'
import { collaboratorsAcceptInviteRequestSchema } from '@keimelion/sdk/schemas'
import { authMiddleware, getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { acceptListInvite } from '../../collaborators.service.js'

export function mountAcceptInvite(router: FeatureRouter): void {
  router.post(
    '/invites/accept',
    authMiddleware,
    RATE_LIMITS.SENSITIVE(),
    zValidator('json', collaboratorsAcceptInviteRequestSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await acceptListInvite(user, input))
    },
  )
}
