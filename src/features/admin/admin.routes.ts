import { createFeatureRouter } from '../../shared/types/app.js'
import { adminUsersRouter } from './users/admin-users.routes.js'

export const adminRouter = createFeatureRouter()

adminRouter.route('/users', adminUsersRouter)
