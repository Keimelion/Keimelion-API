import { zValidator } from '@hono/zod-validator'
import { adminOccasionTypesCreateRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createOccasionType } from '../admin-occasion-types.service.js'

export function mountCreateOccasionType(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('json', adminOccasionTypesCreateRequestSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createOccasionType(admin.id, input))
    },
  )
}
