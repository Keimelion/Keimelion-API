import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { listReservations } from '../admin-reservations.service.js'
import { adminReservationsEntity } from '../admin-reservations.repository.js'

const listAdminReservationsQuerySchema = paginationQuerySchema.extend({
  sort: adminReservationsEntity.buildListQuerySchema(),
  userId: z.guid().optional(),
  listItemId: z.guid().optional(),
  listId: z.guid().optional(),
  itemId: z.guid().optional(),
})

export type ListAdminReservationsInput = z.infer<typeof listAdminReservationsQuerySchema>

export function mountListReservations(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', listAdminReservationsQuerySchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('query')
      return jsonResult(context, await listReservations(input))
    },
  )
}
