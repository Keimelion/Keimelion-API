import { toItemWithSources, toListItemDetail } from '../../../shared/types/item.js'
import type { ItemSourceDetail, ItemWithSources, ListItemDetail } from '../../../shared/types/item.js'
import type { Locale } from '../../../shared/enums/locale.js'
import type { AdminListItemRow } from './admin-list-items.repository.js'
import type { CurrencyTotals } from './admin-lists.mapper.js'

export interface AdminListItemResponse extends ListItemDetail {
  item: ItemWithSources
  sources: ItemSourceDetail[]
  averagePrice: CurrencyTotals
}

export function toAdminListItemResponse(
  row: AdminListItemRow,
  locale: Locale,
  averagePrice: CurrencyTotals = {},
): AdminListItemResponse {
  const item = toItemWithSources(row.item, locale)
  return {
    ...toListItemDetail(row),
    item,
    sources: item.sources,
    averagePrice,
  }
}
