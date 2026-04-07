import { Hono } from 'hono'
import type { AppVariables } from '../../shared/types/app.js'
import { authMiddleware } from '../../shared/middlewares/auth.js'
import { mountGetProfile } from './endpoints/get-profile.js'
import { mountUpdateProfile } from './endpoints/update-profile.js'
import { mountDeleteAccount } from './endpoints/delete-account.js'

export const usersRouter = new Hono<{ Variables: AppVariables }>()
usersRouter.use('*', authMiddleware)
mountGetProfile(usersRouter)
mountUpdateProfile(usersRouter)
mountDeleteAccount(usersRouter)
