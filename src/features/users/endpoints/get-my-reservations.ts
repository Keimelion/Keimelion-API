import { zValidator } from '@hono/zod-validator'
import { usersListReservationsQuerySchema } from '@keimelion/sdk/schemas'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { listMyReservations } from '../users.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountGetMyReservations(router: FeatureRouter): void {
  router.get(
    '/me/reservations',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('query', usersListReservationsQuerySchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const query = context.req.valid('query')
      return jsonResult(context, await listMyReservations(user.id, query))
    },
  )
}
