import { Hono } from 'hono'
import { healthRouter } from './health/health.routes.js'
import { authRouter } from './auth/auth.routes.js'
import { usersRouter } from './users/users.routes.js'
import { adminRouter } from './admin/admin.routes.js'
import { occasionTypesRouter } from './occasion-types/occasion-types.routes.js'
import { listsRouter } from './lists/lists.routes.js'
import { listItemsRouter } from './list-items/list-items.routes.js'

export function mountRoutes(app: Hono): void {
  const v1 = new Hono()
  v1.route('/health', healthRouter)
  v1.route('/auth', authRouter)
  v1.route('/users', usersRouter)
  v1.route('/admin', adminRouter)
  v1.route('/occasion-types', occasionTypesRouter)
  v1.route('/lists', listsRouter)
  v1.route('/list-items', listItemsRouter)
  app.route('/v1', v1)
}
