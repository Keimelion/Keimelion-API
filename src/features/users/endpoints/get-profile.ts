import type { Hono } from 'hono'
import type { AppVariables } from '../../../shared/types/app.js'
import { getProfile } from '../users.service.js'

export function mountGetProfile(router: Hono<{ Variables: AppVariables }>): void {
  router.get('/me', async (context) => {
    const user = context.get('user')
    const { data, httpStatus } = await getProfile(user.id)
    return context.json(data, httpStatus as 200)
  })
}
