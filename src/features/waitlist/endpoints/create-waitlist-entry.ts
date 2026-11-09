import { zValidator } from '@hono/zod-validator'
import { waitlistCreateRequestSchema } from '@keimelion/sdk/schemas'
import { getClientIp, RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { createWaitlistEntry } from '../waitlist.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountCreateWaitlistEntry(router: FeatureRouter): void {
  router.post(
    '/',
    RATE_LIMITS.WAITLIST_SIGNUP(),
    zValidator('json', waitlistCreateRequestSchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('json')
      return jsonResult(context, await createWaitlistEntry(input, getClientIp(context)))
    },
  )
}
