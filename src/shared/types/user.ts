import type { User } from '../../db/entities/users/users.schema.js'

export interface BaseUser {
  id: string
  email: string
  username: string | null
  authProvider: User['authProvider']
  role: User['role']
  avatarUrl: string | null
  isCgvAccepted: boolean
  cgvAcceptedAt: Date | null
  isMarketingOptedIn: boolean
  emailVerifiedAt: Date | null
  lastActiveAt: Date | null
  createdAt: Date
  updatedAt: Date
}
