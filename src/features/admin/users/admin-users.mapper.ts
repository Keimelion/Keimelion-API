import type { User } from '../../../db/entities/users/users.schema.js'
import { toUserDetail } from '../../../shared/types/user.js'
import type { UserDetail, UserRowWithAvatar } from '../../../shared/types/user.js'

export interface AdminUser extends UserDetail {
  bannedAt: Date | null
  banReason: string | null
  deletedAt: Date | null
  reservationsCount: number
}

export function toAdminUser(
  user: User | UserRowWithAvatar,
  reservationsCount: number,
): AdminUser {
  return {
    ...toUserDetail(user),
    bannedAt: user.bannedAt ?? null,
    banReason: user.banReason ?? null,
    deletedAt: user.deletedAt ?? null,
    reservationsCount,
  }
}
