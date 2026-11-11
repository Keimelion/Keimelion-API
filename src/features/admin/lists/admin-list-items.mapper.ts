import { toItemWithSources, toListItemDetail } from '../../../shared/types/item.js'
import type { Locale, SupportedCurrency } from '@keimelion/sdk/enums'
import type { AdminListItemRow } from './admin-list-items.repository.js'
import type { AdminListItemDetailParsed } from '@keimelion/sdk/schemas'

export type AdminListItemResponse = AdminListItemDetailParsed

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
