import { zValidator } from '@hono/zod-validator'
import { feedbackCreateRequestSchema } from '@keimelion/sdk/schemas'
import { optionalAuthMiddleware, getOptionalAuthUser } from '../../../shared/middlewares/optional-auth.js'
import { createFeedbackRateLimiters } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { createFeedback } from '../feedback.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountCreateFeedback(router: FeatureRouter): void {
  const [perMinuteLimiter, perHourLimiter] = createFeedbackRateLimiters()
  router.post(
    '/',
    optionalAuthMiddleware,
    perMinuteLimiter,
    perHourLimiter,
    zValidator('json', feedbackCreateRequestSchema, validationErrorHandler),
    async (context) => {
      const user = getOptionalAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createFeedback(user?.id ?? null, input))
    },
  )
}
