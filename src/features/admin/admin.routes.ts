import { Hono } from 'hono'
import type { AppVariables } from '../../shared/types/app.js'
import { authMiddleware } from '../../shared/middlewares/auth.js'
import { requireAdminMiddleware } from '../../shared/middlewares/require-admin.js'
import { adminUsersRouter } from './users/admin-users.routes.js'

export const adminRouter = new Hono<{ Variables: AppVariables }>()

adminRouter.use('*', authMiddleware)
adminRouter.use('*', requireAdminMiddleware)

adminRouter.route('/users', adminUsersRouter)
