import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createRateLimiter } from '../../../shared/utils/rate-limiter.js'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { HonoContextKey } from '../../../shared/enums/context-key.js'
import { logoutUser } from '../auth.service.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import type { AppVariables } from '../../../shared/types/app.js'

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
})

export type LogoutInput = z.infer<typeof logoutSchema>

export function mountLogout(router: Hono<{ Variables: AppVariables }>): void {
  router.post(
    '/logout',
    createRateLimiter(5),
    authMiddleware,
    zValidator('json', logoutSchema, validationErrorHandler),
    async (context) => {
      const jwtPayload = context.get(HonoContextKey.JWT_PAYLOAD)
      const user = context.get(HonoContextKey.USER)
      const { refreshToken } = context.req.valid('json')
      const { data, httpStatus } = await logoutUser(jwtPayload, user.id, refreshToken)

      if (httpStatus !== HttpStatus.NO_CONTENT) {
        return context.json(data, httpStatus as 500)
      }

      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
