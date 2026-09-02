import { Hono } from 'hono'
import { mountRegister } from './endpoints/register.js'
import { mountVerifyEmail } from './endpoints/verify-email.js'
import { mountLogin } from './endpoints/login.js'
import { mountLogout } from './endpoints/logout.js'
import { mountForgotPassword } from './endpoints/forgot-password.js'
import { mountResetPassword } from './endpoints/reset-password.js'
import type { AppVariables } from '../../shared/types/app.js'

export const authRouter = new Hono<{ Variables: AppVariables }>()
mountRegister(authRouter)
mountVerifyEmail(authRouter)
mountLogin(authRouter)
mountLogout(authRouter)
mountForgotPassword(authRouter)
mountResetPassword(authRouter)
