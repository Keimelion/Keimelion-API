import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { authMiddleware, getAuthUser, getJwtPayload } from '../../../shared/middlewares/auth.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { logoutUser } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
})

export type LogoutInput = z.infer<typeof logoutSchema>

export function mountLogout(router: FeatureRouter): void {
  router.post(
    '/logout',
    RATE_LIMITS.STRICT(),
    authMiddleware,
    zValidator('json', logoutSchema, validationErrorHandler),
    async (context) => {
      const jwtPayload = getJwtPayload(context)
      const user = getAuthUser(context)
      const { refreshToken } = context.req.valid('json')
      return jsonResult(context, await logoutUser(jwtPayload, user.id, refreshToken))
    },
  )
}
