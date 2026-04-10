import type { User } from '../../db/entities/users/users.schema.js'
import type { JwtPayload } from '../../features/auth/jwt.service.js'

export interface AppVariables {
  user: User
  jwtPayload: JwtPayload
}
