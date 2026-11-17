import { zValidator } from '@hono/zod-validator'
import { verifyEmailRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { verifyEmail } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountVerifyEmail(router: FeatureRouter): void {
  router.post(
    '/verify-email',
    RATE_LIMITS.SENSITIVE(),
    zValidator('json', verifyEmailRequestSchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('json')
      return jsonResult(context, await verifyEmail(input))
    },
  )
}
