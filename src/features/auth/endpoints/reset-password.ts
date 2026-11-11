import { zValidator } from '@hono/zod-validator'
import { resetPasswordRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { resetPassword } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountResetPassword(router: FeatureRouter): void {
  router.post(
    '/reset-password',
    RATE_LIMITS.SENSITIVE(),
    zValidator('json', resetPasswordRequestSchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('json')
      return jsonResult(context, await resetPassword(input))
    },
  )
}
