import { zValidator } from '@hono/zod-validator'
import { reportsCreateRequestSchema } from '@keimelion/sdk/schemas'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { createReportRateLimiters } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { createReport } from '../reports.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountCreateReport(router: FeatureRouter): void {
  const [perMinuteLimiter, perHourLimiter] = createReportRateLimiters()
  router.post(
    '/',
    authMiddleware,
    perMinuteLimiter,
    perHourLimiter,
    zValidator('json', reportsCreateRequestSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createReport(user.id, input))
    },
  )
}
