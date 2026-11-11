import { zValidator } from '@hono/zod-validator'
import { adminReservationsListQuerySchema } from '@keimelion/sdk/schemas'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { listReservations } from '../admin-reservations.service.js'

export function mountListReservations(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', adminReservationsListQuerySchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('query')
      return jsonResult(context, await listReservations(input))
    },
  )
}
