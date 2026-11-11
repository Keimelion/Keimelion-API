import type { User } from '../../db/entities/users/users.schema.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { SupportedCurrency } from '@keimelion/sdk/enums'
import type { UserDetailParsed } from '@keimelion/sdk/schemas'
import { toImageDetail } from '../../features/uploads/images.mapper.js'

export type UserDetail = UserDetailParsed

export interface UserWrite {
  username: string | null
  isMarketingOptedIn: boolean
  defaultCurrencyCode: SupportedCurrency
}

export interface UserRowWithAvatar extends User {
  avatarImage: Image | null
}

export function toUserDetail(user: UserRowWithAvatar): UserDetailParsed {
  const { avatarImage } = user
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    authProvider: user.authProvider,
    role: user.role,
    avatarImageId: user.avatarImageId ?? null,
    avatar: avatarImage ? toImageDetail(avatarImage) : null,
    isCgvAccepted: user.isCgvAccepted,
    cgvAcceptedAt: user.cgvAcceptedAt ?? null,
    isMarketingOptedIn: user.isMarketingOptedIn,
    defaultCurrency: user.defaultCurrencyCode as SupportedCurrency,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    lastActiveAt: user.lastActiveAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}
