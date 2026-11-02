import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { paginationQuerySchema } from '../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { userReservationsEntity } from '../../../db/entities/reservations/reservations.repository.js'
import { listMyReservations } from '../users.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const listMyReservationsQuerySchema = paginationQuerySchema.extend({
  sort: userReservationsEntity.buildListQuerySchema(),
})

export type ListMyReservationsInput = z.infer<typeof listMyReservationsQuerySchema>

export function mountGetMyReservations(router: FeatureRouter): void {
  router.get(
    '/me/reservations',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('query', listMyReservationsQuerySchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const query = context.req.valid('query')
      return jsonResult(context, await listMyReservations(user.id, query))
    },
  )
}
