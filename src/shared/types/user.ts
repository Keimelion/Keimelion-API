import type { User } from '../../db/entities/users/users.schema.js'

export interface UserDetail {
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

export interface UserWrite {
  email: string
  username: string | null
  avatarUrl: string | null
  isMarketingOptedIn: boolean
}
