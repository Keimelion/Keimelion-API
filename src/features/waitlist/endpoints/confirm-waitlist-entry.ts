import { zValidator } from '@hono/zod-validator'
import { HttpStatus } from '@keimelion/sdk/enums'
import { waitlistConfirmRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { confirmWaitlistEntry } from '../waitlist.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountConfirmWaitlistEntry(router: FeatureRouter): void {
  router.post(
    '/confirm',
    RATE_LIMITS.WAITLIST_TOKEN(),
    zValidator('json', waitlistConfirmRequestSchema, validationErrorHandler),
    async (context) => {
      const result = await confirmWaitlistEntry(context.req.valid('json'))
      if (result.httpStatus !== HttpStatus.NO_CONTENT) return jsonResult(context, result)
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
