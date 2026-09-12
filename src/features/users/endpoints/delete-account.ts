import type { Hono } from 'hono'
import { HonoContextKey } from '../../../shared/enums/context-key.js'
import type { AppVariables } from '../../../shared/types/app.js'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { deleteAccount } from '../users.service.js'

export function mountDeleteAccount(router: Hono<{ Variables: AppVariables }>): void {
  router.delete('/me', authMiddleware, async (context) => {
    const user = context.get(HonoContextKey.USER)
    const { data, httpStatus } = await deleteAccount(user.id, user.email)
    return context.json(data, httpStatus as 200)
  })
}
