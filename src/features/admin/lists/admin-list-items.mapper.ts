import { toItemWithSources, toListItemDetail } from '../../../shared/types/item.js'
import type { ItemSourceDetail, ItemWithSources, ListItemDetail } from '../../../shared/types/item.js'
import type { Locale } from '../../../shared/enums/locale.js'
import type { AdminListItemRow } from './admin-list-items.repository.js'

export interface AdminListItemResponse extends ListItemDetail {
  item: ItemWithSources
  sources: ItemSourceDetail[]
}

export function toAdminListItemResponse(row: AdminListItemRow, locale: Locale): AdminListItemResponse {
  const item = toItemWithSources(row.item, locale)
  return {
    ...toListItemDetail(row),
    item,
    sources: item.sources,
  }
}
