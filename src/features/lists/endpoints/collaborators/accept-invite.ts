import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { INVITE_TOKEN_HASH_LENGTH } from '../../../../db/entities/list-invites/list-invites.schema.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { acceptListInvite } from '../../collaborators.service.js'

const INVITE_TOKEN_HEX_REGEX = /^[a-f0-9]+$/
const INVITE_TOKEN_HEX_MESSAGE = 'Invitation token must be a hex-encoded SHA-256 value'

const acceptInviteSchema = z
  .object({
    token: z
      .string()
      .length(INVITE_TOKEN_HASH_LENGTH)
      .regex(INVITE_TOKEN_HEX_REGEX, INVITE_TOKEN_HEX_MESSAGE),
  })
  .strict()

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>

export function mountAcceptInvite(router: FeatureRouter): void {
  router.post(
    '/invites/accept',
    authMiddleware,
    RATE_LIMITS.SENSITIVE(),
    zValidator('json', acceptInviteSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await acceptListInvite(user, input))
    },
  )
}
