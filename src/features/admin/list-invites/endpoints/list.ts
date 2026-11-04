import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { INVITE_STATUS_VALUES } from '../../../../shared/enums/invite-status.js'
import { listAdminInvites } from '../admin-list-invites.service.js'

const listAdminInvitesQuerySchema = paginationQuerySchema.extend({
  inviteStatus: z.enum(INVITE_STATUS_VALUES).optional(),
})

export type ListAdminInvitesInput = z.infer<typeof listAdminInvitesQuerySchema>

export function mountListAdminInvites(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('query', listAdminInvitesQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      return jsonResult(context, await listAdminInvites(query))
    },
  )
}
