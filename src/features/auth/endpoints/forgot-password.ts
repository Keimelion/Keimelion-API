import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { requestPasswordReset } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const forgotPasswordSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export function mountForgotPassword(router: FeatureRouter): void {
  router.post(
    '/forgot-password',
    RATE_LIMITS.SENSITIVE(),
    zValidator('json', forgotPasswordSchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('json')
      return jsonResult(context, await requestPasswordReset(input))
    },
  )
}
