import type { User } from '../../db/entities/users/users.schema.js'

export interface PublicUser {
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

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    authProvider: user.authProvider,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    isCgvAccepted: user.isCgvAccepted,
    cgvAcceptedAt: user.cgvAcceptedAt ?? null,
    isMarketingOptedIn: user.isMarketingOptedIn,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    lastActiveAt: user.lastActiveAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}
