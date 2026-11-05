import { zValidator } from '@hono/zod-validator'
import { logoutRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { authMiddleware, getAuthUser, getJwtPayload } from '../../../shared/middlewares/auth.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { logoutUser } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountLogout(router: FeatureRouter): void {
  router.post(
    '/logout',
    RATE_LIMITS.STRICT(),
    authMiddleware,
    zValidator('json', logoutRequestSchema, validationErrorHandler),
    async (context) => {
      const jwtPayload = getJwtPayload(context)
      const user = getAuthUser(context)
      const { refreshToken } = context.req.valid('json')
      return jsonResult(context, await logoutUser(jwtPayload, user.id, refreshToken))
    },
  )
}
