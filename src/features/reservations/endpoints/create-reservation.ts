import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getOptionalAuthUser, optionalAuthMiddleware } from '../../../shared/middlewares/optional-auth.js'
import { authAwareRateLimiter, createRateLimiter, RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { RESERVER_EMAIL_MAX_LENGTH, RESERVER_NAME_MAX_LENGTH } from '../../../db/entities/reservations/reservations.schema.js'
import { createOrUpdateReservation } from '../reservations.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const ANONYMOUS_RESERVATION_LIMIT_PER_MINUTE = 5

const RESERVER_EMAIL_REQUIRES_NAME_MESSAGE = 'reserverEmail requires reserverName'

const createReservationBodySchema = z
  .object({
    listItemId: z.guid(),
    quantityBooked: z.number().int().min(1),
    reserverName: z
      .string()
      .trim()
      .min(1)
      .max(
        RESERVER_NAME_MAX_LENGTH,
        `reserverName must be at most ${String(RESERVER_NAME_MAX_LENGTH)} characters`,
      )
      .nullish()
      .transform((value) => value ?? null),
    reserverEmail: z
      .email()
      .max(
        RESERVER_EMAIL_MAX_LENGTH,
        `reserverEmail must be at most ${String(RESERVER_EMAIL_MAX_LENGTH)} characters`,
      )
      .transform((value) => value.toLowerCase())
      .nullish()
      .transform((value) => value ?? null),
  })
  .strict()
  .refine((body) => body.reserverEmail === null || body.reserverName !== null, {
    message: RESERVER_EMAIL_REQUIRES_NAME_MESSAGE,
    path: ['reserverEmail'],
  })

export function mountCreateReservation(router: FeatureRouter): void {
  router.post(
    '/',
    optionalAuthMiddleware,
    authAwareRateLimiter(
      RATE_LIMITS.STANDARD(),
      createRateLimiter(ANONYMOUS_RESERVATION_LIMIT_PER_MINUTE),
    ),
    zValidator('json', createReservationBodySchema, validationErrorHandler),
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
