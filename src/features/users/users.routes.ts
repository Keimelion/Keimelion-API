import { Hono } from 'hono'
import type { AppVariables } from '../../shared/types/app.js'
import { mountGetProfile } from './endpoints/get-profile.js'
import { mountUpdateProfile } from './endpoints/update-profile.js'
import { mountDeleteAccount } from './endpoints/delete-account.js'
import { mountChangePassword } from './endpoints/change-password.js'
import { mountExportData } from './endpoints/export-data.js'

export const usersRouter = new Hono<{ Variables: AppVariables }>()
mountGetProfile(usersRouter)
mountUpdateProfile(usersRouter)
mountDeleteAccount(usersRouter)
mountChangePassword(usersRouter)
mountExportData(usersRouter)
