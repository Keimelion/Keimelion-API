import { toItemDetail, toItemSourceDetail, toListItemDetail } from '../../../shared/types/item.js'
import type { ItemDetail, ItemSourceDetail, ListItemDetail } from '../../../shared/types/item.js'
import type { AdminListItemRow } from './admin-list-items.repository.js'

export interface AdminListItemResponse extends ListItemDetail {
  item: ItemDetail
  sources: ItemSourceDetail[]
}

export function toAdminListItemResponse(row: AdminListItemRow): AdminListItemResponse {
  return {
    ...toListItemDetail(row),
    item: toItemDetail(row.item),
    sources: row.item.sources.map(toItemSourceDetail),
  }
}
