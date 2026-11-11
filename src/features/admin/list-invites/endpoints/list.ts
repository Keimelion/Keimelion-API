import { zValidator } from '@hono/zod-validator'
import { adminCollaboratorInvitesListQuerySchema } from '@keimelion/sdk/schemas'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { listAdminInvites } from '../admin-list-invites.service.js'

export function mountListAdminInvites(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('query', adminCollaboratorInvitesListQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      return jsonResult(context, await listAdminInvites(query))
    },
  )
}
