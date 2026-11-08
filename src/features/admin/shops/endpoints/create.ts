import { zValidator } from '@hono/zod-validator'
import { adminShopsCreateRequestSchema } from '@keimelion/sdk/schemas'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createShop } from '../admin-shops.service.js'

export function mountCreateShop(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('json', adminShopsCreateRequestSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createShop(admin.id, input))
    },
  )
}
