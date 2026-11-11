import { zValidator } from '@hono/zod-validator'
import { reservationsCreateRequestSchema } from '@keimelion/sdk/schemas'
import { getOptionalAuthUser, optionalAuthMiddleware } from '../../../shared/middlewares/optional-auth.js'
import { authAwareRateLimiter, createRateLimiter, RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { createOrUpdateReservation } from '../reservations.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const ANONYMOUS_RESERVATION_LIMIT_PER_MINUTE = 5

export function mountCreateReservation(router: FeatureRouter): void {
  router.post(
    '/',
    optionalAuthMiddleware,
    authAwareRateLimiter(
      RATE_LIMITS.STANDARD(),
      createRateLimiter(ANONYMOUS_RESERVATION_LIMIT_PER_MINUTE),
    ),
    zValidator('json', reservationsCreateRequestSchema, validationErrorHandler),
    async (context) => {
      const body = context.req.valid('json')
      const authUser = getOptionalAuthUser(context)
      return jsonResult(
        context,
        await createOrUpdateReservation({ ...body, authUserId: authUser?.id ?? null }),
      )
    },
  )
}
