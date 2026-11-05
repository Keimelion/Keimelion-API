import { zValidator } from '@hono/zod-validator'
import { forgotPasswordRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { requestPasswordReset } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountForgotPassword(router: FeatureRouter): void {
  router.post(
    '/forgot-password',
    RATE_LIMITS.SENSITIVE(),
    zValidator('json', forgotPasswordRequestSchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('json')
      return jsonResult(context, await requestPasswordReset(input))
    },
  )
}
