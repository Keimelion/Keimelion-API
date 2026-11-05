import { toItemWithSources, toListItemDetail } from '../../../shared/types/item.js'
import type { ItemSourceDetail, ItemWithSources, ListItemDetail } from '../../../shared/types/item.js'
import type { Locale, SupportedCurrency } from '@keimelion/sdk/enums'
import type { AdminListItemRow } from './admin-list-items.repository.js'

export interface AdminListItemResponse extends ListItemDetail {
  item: ItemWithSources
  sources: ItemSourceDetail[]
  averagePrice: string | null
  displayCurrency: SupportedCurrency
}

export function toAdminListItemResponse(
  row: AdminListItemRow,
  locale: Locale,
  displayCurrency: SupportedCurrency,
  averagePrice: string | null,
): AdminListItemResponse {
  const item = toItemWithSources(row.item, locale)
  return {
    ...toListItemDetail(row),
    item,
    sources: item.sources,
    averagePrice,
    displayCurrency,
  }
}
