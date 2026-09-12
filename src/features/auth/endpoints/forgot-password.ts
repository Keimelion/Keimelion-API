import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createRateLimiter } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { requestPasswordReset } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const PASSWORD_RESET_RATE_LIMIT_MAX = 10
const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 600_000

const forgotPasswordSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export function mountForgotPassword(router: FeatureRouter): void {
  router.post(
    '/forgot-password',
    createRateLimiter(PASSWORD_RESET_RATE_LIMIT_MAX, PASSWORD_RESET_RATE_LIMIT_WINDOW_MS),
    zValidator('json', forgotPasswordSchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('json')
      return jsonResult(context, await requestPasswordReset(input))
    },
  )
}
