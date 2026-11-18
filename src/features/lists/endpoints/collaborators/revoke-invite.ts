import { zValidator } from '@hono/zod-validator'
import { HttpStatus } from '@keimelion/sdk/enums'
import { listInviteParamSchema } from '../../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../../shared/middlewares/auth.js'
import { listOwnershipMiddleware } from '../../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { revokeListInvite } from '../../collaborators.service.js'

export function mountRevokeInvite(router: FeatureRouter): void {
  router.delete(
    '/:id/collaborators/invites/:inviteId',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', listInviteParamSchema, validationErrorHandler),
    listOwnershipMiddleware({ paramName: 'id' }),
    async (context) => {
      const { id, inviteId } = context.req.valid('param')
      const result = await revokeListInvite(getAuthUser(context).id, id, inviteId)
      if (result.httpStatus !== HttpStatus.NO_CONTENT) return jsonResult(context, result)
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
