import { Hono } from 'hono'
import { mountRegister } from './endpoints/register.js'
import { mountVerifyEmail } from './endpoints/verify-email.js'
import { mountLogin } from './endpoints/login.js'

export const authRouter = new Hono()
mountRegister(authRouter)
mountVerifyEmail(authRouter)
mountLogin(authRouter)
