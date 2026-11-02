import type { User } from '../../db/entities/users/users.schema.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { SupportedCurrency } from '../enums/currency.js'
import { toImageDetail } from '../../features/uploads/images.mapper.js'
import type { ImageDetail } from '../../features/uploads/images.mapper.js'

export interface UserDetail {
  id: string
  email: string
  username: string | null
  authProvider: User['authProvider']
  role: User['role']
  avatarUrl: string | null
  avatarImageId: string | null
  avatar: ImageDetail | null
  isCgvAccepted: boolean
  cgvAcceptedAt: Date | null
  isMarketingOptedIn: boolean
  defaultCurrency: SupportedCurrency
  emailVerifiedAt: Date | null
  lastActiveAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UserWrite {
  username: string | null
  avatarUrl: string | null
  isMarketingOptedIn: boolean
  defaultCurrencyCode: SupportedCurrency
}

export interface UserRowWithAvatar extends User {
  avatarImage: Image | null
}

export function toUserDetail(user: User | UserRowWithAvatar): UserDetail {
  const avatarImage = 'avatarImage' in user ? user.avatarImage : null
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    authProvider: user.authProvider,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
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
