import type { User } from '../../../db/entities/users/users.schema.js'
import { toBaseUser } from '../../users/users.mapper.js'
import type { BaseUser } from '../../../shared/types/user.js'

export interface AdminUser extends BaseUser {
  bannedAt: Date | null
  banReason: string | null
  deletedAt: Date | null
}

export function toAdminUser(user: User): AdminUser {
  return {
    ...toBaseUser(user),
    bannedAt: user.bannedAt ?? null,
    banReason: user.banReason ?? null,
    deletedAt: user.deletedAt ?? null,
  }
}
