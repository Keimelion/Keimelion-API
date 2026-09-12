import { Hono } from 'hono'
import type { AppVariables } from '../../shared/types/app.js'
import { adminUsersRouter } from './users/admin-users.routes.js'

export const adminRouter = new Hono<{ Variables: AppVariables }>()

adminRouter.route('/users', adminUsersRouter)
