import { zValidator } from '@hono/zod-validator'
import { getOptionalAuthUser, optionalAuthMiddleware } from '../../../shared/middlewares/optional-auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { getReservation } from '../reservations.service.js'
import { extractReservationToken } from '../reservations.token.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountGetReservation(router: FeatureRouter): void {
  router.get(
    '/:id',
    optionalAuthMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      const result = await getReservation(id, {
        authUserId: getOptionalAuthUser(context)?.id ?? null,
        rawReservationToken: extractReservationToken(context.req.header('Authorization')),
      })
      return jsonResult(context, result)
    },
  )
}
