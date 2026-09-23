import type { User } from '../../../db/entities/users/users.schema.js'
import { toUserDetail } from '../../../shared/types/user.js'
import type { UserDetail } from '../../../shared/types/user.js'

export interface AdminUser extends UserDetail {
  bannedAt: Date | null
  banReason: string | null
  deletedAt: Date | null
}

export function toAdminUser(user: User): AdminUser {
  return {
    ...toUserDetail(user),
    bannedAt: user.bannedAt ?? null,
    banReason: user.banReason ?? null,
    deletedAt: user.deletedAt ?? null,
  }
}
