import { createFeatureRouter } from '../../shared/types/app.js'
import { adminUsersRouter } from './users/admin-users.routes.js'
import { adminOccasionTypesRouter } from './occasion-types/admin-occasion-types.routes.js'
import { adminShopsRouter } from './shops/admin-shops.routes.js'
import { adminItemsRouter } from './items/admin-items.routes.js'
import { adminListsRouter } from './lists/admin-lists.routes.js'

export const adminRouter = createFeatureRouter()

adminRouter.route('/users', adminUsersRouter)
adminRouter.route('/occasion-types', adminOccasionTypesRouter)
adminRouter.route('/shops', adminShopsRouter)
adminRouter.route('/items', adminItemsRouter)
adminRouter.route('/lists', adminListsRouter)
