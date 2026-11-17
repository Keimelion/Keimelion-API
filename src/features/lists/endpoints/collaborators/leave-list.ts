import { zValidator } from '@hono/zod-validator'
import { HttpStatus } from '@keimelion/sdk/enums'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../../shared/middlewares/auth.js'
import { getList, listContributorMiddleware } from '../../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { leaveList } from '../../collaborators.service.js'

export function mountLeaveList(router: FeatureRouter): void {
  router.delete(
    '/:id/collaborators/me',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    listContributorMiddleware({ paramName: 'id' }),
    async (context) => {
      const result = await leaveList(getList(context), getAuthUser(context).id)
      if (result.httpStatus !== HttpStatus.NO_CONTENT) return jsonResult(context, result)
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
