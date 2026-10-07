import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { listOwnershipMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { deleteUserList } from '../lists.service.js'

export function mountDeleteUserList(router: FeatureRouter): void {
  router.delete(
    '/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    listOwnershipMiddleware({ paramName: 'id' }),
    async (context) => {
      const { id } = context.req.valid('param')
      const result = await deleteUserList(id)
      if (result.httpStatus !== HttpStatus.NO_CONTENT) {
        return jsonResult(context, result)
      }
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
