import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createRateLimiter } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { resetPassword } from '../auth.service.js'
import type { AppVariables } from '../../../shared/types/app.js'

const PASSWORD_RESET_RATE_LIMIT_MAX = 10
const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 600_000
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 72

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export function mountResetPassword(router: Hono<{ Variables: AppVariables }>): void {
  router.post(
    '/reset-password',
    createRateLimiter(PASSWORD_RESET_RATE_LIMIT_MAX, PASSWORD_RESET_RATE_LIMIT_WINDOW_MS),
    zValidator('json', resetPasswordSchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('json')
      const { data, httpStatus } = await resetPassword(input)
      return context.json(data, httpStatus as 200)
    },
  )
}
