import { toUserDetail } from '../../../shared/types/user.js'
import type { UserRowWithAvatar } from '../../../shared/types/user.js'
import type { AdminUserDetailParsed } from '@keimelion/sdk/schemas'
import { deriveUserStatus } from './admin-users.status.js'

export type AdminUser = AdminUserDetailParsed

export function toAdminUser(
  user: UserRowWithAvatar,
  reservationsCount: number,
): AdminUser {
  return {
    ...toUserDetail(user),
    bannedAt: user.bannedAt ?? null,
    banReason: user.banReason ?? null,
    deletedAt: user.deletedAt ?? null,
    activatedAt: user.activatedAt ?? null,
    status: deriveUserStatus(user, new Date()),
    reservationsCount,
  }
}
