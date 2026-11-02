import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { createOrUpdateReservation } from '../reservations.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const createReservationBodySchema = z
  .object({
    quantityBooked: z.number().int().min(1),
  })
  .strict()

export function mountCreateReservation(router: FeatureRouter): void {
  router.post(
    '/list-items/:id/reserve',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', createReservationBodySchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      const { quantityBooked } = context.req.valid('json')
      const user = getAuthUser(context)
      return jsonResult(
        context,
        await createOrUpdateReservation({ listItemId: id, userId: user.id, quantityBooked }),
      )
    },
  )
}
