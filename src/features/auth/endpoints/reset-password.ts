import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { resetPassword } from '../auth.service.js'
import { MAX_PASSWORD_LENGTH } from '../../users/users.constants.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const MIN_PASSWORD_LENGTH = 8

const resetPasswordSchema = z.object({
  passwordResetToken: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export function mountResetPassword(router: FeatureRouter): void {
  router.post(
    '/reset-password',
    RATE_LIMITS.SENSITIVE(),
    zValidator('json', resetPasswordSchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('json')
      return jsonResult(context, await resetPassword(input))
    },
  )
}
