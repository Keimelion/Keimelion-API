import { zValidator } from '@hono/zod-validator'
import { resendVerificationRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { resolveEmailLocale } from '../../../shared/mail/mail.locale.js'
import { resendVerificationEmail } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountResendVerification(router: FeatureRouter): void {
  router.post(
    '/resend-verification',
    RATE_LIMITS.SENSITIVE(),
    zValidator('json', resendVerificationRequestSchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('json')
      const emailLocale = resolveEmailLocale(context.req.header('Accept-Language'))
      return jsonResult(context, await resendVerificationEmail(input, emailLocale))
    },
  )
}
