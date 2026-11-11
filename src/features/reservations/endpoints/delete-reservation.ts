import { zValidator } from '@hono/zod-validator'
import { getOptionalAuthUser, optionalAuthMiddleware } from '../../../shared/middlewares/optional-auth.js'
import { HttpStatus } from '@keimelion/sdk/enums'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { cancelReservation } from '../reservations.service.js'
import { extractReservationToken } from '../reservations.token.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountDeleteReservation(router: FeatureRouter): void {
  router.delete(
    '/:id',
    optionalAuthMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      const result = await cancelReservation(id, {
        authUserId: getOptionalAuthUser(context)?.id ?? null,
        rawReservationToken: extractReservationToken(context.req.header('Authorization')),
      })
      if (result.httpStatus !== HttpStatus.NO_CONTENT) {
        return jsonResult(context, result)
      }
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
