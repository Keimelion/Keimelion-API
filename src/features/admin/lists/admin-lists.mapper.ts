import { toListDetail } from '../../../shared/types/list.js'
import { toUserDetail } from '../../../shared/types/user.js'
import type { ListDetail, ListRowWithOwner } from '../../../shared/types/list.js'

export interface AdminListDetail extends ListDetail {
  deletedAt: Date | null
}

export function toAdminListDetail(row: ListRowWithOwner): AdminListDetail {
  const ownerUser = row.collaborators[0]?.user ?? null
  return {
    ...toListDetail(row, ownerUser ? toUserDetail(ownerUser) : null),
    deletedAt: row.deletedAt ?? null,
  }
}
