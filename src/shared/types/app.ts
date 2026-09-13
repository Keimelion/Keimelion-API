import { Hono } from 'hono'
import type { User } from '../../db/entities/users/users.schema.js'
import type { JwtPayload } from '../../features/auth/jwt.service.js'
import type { Locale } from '../enums/locale.js'

export interface AppVariables {
  user: User
  jwtPayload: JwtPayload
  locale: Locale
}

export type FeatureRouter = Hono<{ Variables: AppVariables }>

export const createFeatureRouter = (): FeatureRouter => new Hono<{ Variables: AppVariables }>()
