import type { Hono } from 'hono'
import { createRateLimiter } from '../../../shared/utils/rate-limiter.js'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { HonoContextKey } from '../../../shared/enums/context-key.js'
import { logoutUser } from '../auth.service.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import type { AppVariables } from '../../../shared/types/app.js'

export function mountLogout(router: Hono<{ Variables: AppVariables }>): void {
  router.post('/logout', createRateLimiter(5), authMiddleware, async (context) => {
    const jwtPayload = context.get(HonoContextKey.JWT_PAYLOAD)
    const user = context.get(HonoContextKey.USER)
    const { data, httpStatus } = await logoutUser(jwtPayload, user.id)

    if (httpStatus !== HttpStatus.NO_CONTENT) {
      return context.json(data, httpStatus as 500)
    }

    return context.body(null, HttpStatus.NO_CONTENT)
  })
}
