import { zValidator } from '@hono/zod-validator'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { cancelReservation } from '../reservations.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountDeleteReservation(router: FeatureRouter): void {
  router.delete(
    '/reservations/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      const user = getAuthUser(context)
      const result = await cancelReservation(id, user.id)
      if (result.httpStatus !== HttpStatus.NO_CONTENT) {
        return jsonResult(context, result)
      }
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
