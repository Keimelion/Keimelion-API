import { extractOwnerDetail, toListDetail } from '../../../shared/types/list.js'
import type { ListDetail, ListRowWithOwner } from '../../../shared/types/list.js'

export interface AdminListDetail extends ListDetail {
  deletedAt: Date | null
}

export function toAdminListDetail(row: ListRowWithOwner): AdminListDetail {
  return {
    ...toListDetail(row, extractOwnerDetail(row)),
    deletedAt: row.deletedAt ?? null,
  }
}
