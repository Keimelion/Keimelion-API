import { zValidator } from '@hono/zod-validator'
import { usersChangePasswordRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { changePassword } from '../users.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountChangePassword(router: FeatureRouter): void {
  router.post(
    '/me/change-password',
    authMiddleware,
    RATE_LIMITS.STRICT(),
    zValidator('json', usersChangePasswordRequestSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await changePassword(user.id, input))
    },
  )
}
