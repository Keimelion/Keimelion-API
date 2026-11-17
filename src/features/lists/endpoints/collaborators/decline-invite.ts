import { zValidator } from '@hono/zod-validator'
import { HttpStatus } from '@keimelion/sdk/enums'
import { collaboratorsDeclineInviteRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { declineListInvite } from '../../collaborators.service.js'

// Public on purpose: holding the emailed token is the proof, so an invitee without an account
// can decline.
export function mountDeclineInvite(router: FeatureRouter): void {
  router.post(
    '/invites/decline',
    RATE_LIMITS.SENSITIVE(),
    zValidator('json', collaboratorsDeclineInviteRequestSchema, validationErrorHandler),
    async (context) => {
      const result = await declineListInvite(context.req.valid('json'))
      if (result.httpStatus !== HttpStatus.NO_CONTENT) return jsonResult(context, result)
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
