import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountCreateUser } from './endpoints/create-user.js'
import { mountListUsers } from './endpoints/list-users.js'
import { mountGetUser } from './endpoints/get-user.js'
import { mountUpdateUser } from './endpoints/update-user.js'
import { mountDeleteUser } from './endpoints/delete-user.js'

export const adminUsersRouter = createFeatureRouter()

mountCreateUser(adminUsersRouter)
mountListUsers(adminUsersRouter)
mountGetUser(adminUsersRouter)
mountUpdateUser(adminUsersRouter)
mountDeleteUser(adminUsersRouter)
