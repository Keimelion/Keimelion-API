import { createFeatureRouter } from '../../shared/types/app.js'
import { adminUsersRouter } from './users/admin-users.routes.js'
import { adminOccasionTypesRouter } from './occasion-types/admin-occasion-types.routes.js'

export const adminRouter = createFeatureRouter()

adminRouter.route('/users', adminUsersRouter)
adminRouter.route('/occasion-types', adminOccasionTypesRouter)
