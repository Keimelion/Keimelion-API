import { zValidator } from '@hono/zod-validator'
import { HttpStatus } from '@keimelion/sdk/enums'
import { listCollaboratorParamSchema } from '../../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../../shared/middlewares/auth.js'
import { listOwnershipMiddleware } from '../../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { removeListCollaborator } from '../../collaborators.service.js'

// Must be mounted after mountLeaveList: `/:userId` would otherwise capture `/me` and reject it
// as an invalid uuid.
export function mountRemoveCollaborator(router: FeatureRouter): void {
  router.delete(
    '/:id/collaborators/:userId',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', listCollaboratorParamSchema, validationErrorHandler),
    listOwnershipMiddleware({ paramName: 'id' }),
    async (context) => {
      const { id, userId } = context.req.valid('param')
      const result = await removeListCollaborator(getAuthUser(context).id, id, userId)
      if (result.httpStatus !== HttpStatus.NO_CONTENT) return jsonResult(context, result)
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
