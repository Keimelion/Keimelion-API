import type { User } from '../../db/entities/users/users.schema.js'
import type { UserDetail } from '../../shared/types/user.js'

export type PublicUser = UserDetail

export function toUserDetail(user: User): UserDetail {
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

export function toPublicUser(user: User): PublicUser {
  return toUserDetail(user)
}
