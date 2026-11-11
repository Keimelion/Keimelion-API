import { zValidator } from '@hono/zod-validator'
import { HttpStatus } from '@keimelion/sdk/enums'
import { waitlistUnsubscribeRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { unsubscribeWaitlistEntry } from '../waitlist.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountUnsubscribeWaitlistEntry(router: FeatureRouter): void {
  router.post(
    '/unsubscribe',
    RATE_LIMITS.WAITLIST_TOKEN(),
    zValidator('json', waitlistUnsubscribeRequestSchema, validationErrorHandler),
    async (context) => {
      const result = await unsubscribeWaitlistEntry(context.req.valid('json'))
      if (result.httpStatus !== HttpStatus.NO_CONTENT) return jsonResult(context, result)
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
