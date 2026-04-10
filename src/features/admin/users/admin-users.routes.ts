import { Hono } from 'hono'
import type { AppVariables } from '../../../shared/types/app.js'
import { mountListUsers } from './endpoints/list-users.js'
import { mountGetUser } from './endpoints/get-user.js'
import { mountUpdateUser } from './endpoints/update-user.js'
import { mountDeleteUser } from './endpoints/delete-user.js'

export const adminUsersRouter = new Hono<{ Variables: AppVariables }>()

mountListUsers(adminUsersRouter)
mountGetUser(adminUsersRouter)
mountUpdateUser(adminUsersRouter)
mountDeleteUser(adminUsersRouter)
