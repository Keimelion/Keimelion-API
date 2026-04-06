import { Hono } from 'hono'
import { healthRouter } from './health/health.routes.js'
import { authRouter } from './auth/auth.routes.js'
import { usersRouter } from './users/users.routes.js'

export function mountRoutes(app: Hono): void {
  const v1 = new Hono()
  v1.route('/health', healthRouter)
  v1.route('/auth', authRouter)
  v1.route('/users', usersRouter)
  app.route('/v1', v1)
}
