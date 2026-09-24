import { toListDetail } from '../../../shared/types/list.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { ListDetail } from '../../../shared/types/list.js'
import type { UserDetail } from '../../../shared/types/user.js'

export interface AdminListDetail extends ListDetail {
  deletedAt: Date | null
}

export function toAdminListDetail(list: List, owner: UserDetail | null): AdminListDetail {
  return {
    ...toListDetail(list, owner),
    deletedAt: list.deletedAt ?? null,
  }
}
