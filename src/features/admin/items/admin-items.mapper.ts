import { toItemWithSources } from '../../../shared/types/item.js'
import type { ItemRowWithSources, ItemWithSources } from '../../../shared/types/item.js'
import type { Locale } from '../../../shared/enums/locale.js'

export interface AdminItem extends ItemWithSources {
  reservationCount: number
}

export function toAdminItem(
  row: ItemRowWithSources,
  locale: Locale,
  reservationCount: number,
): AdminItem {
  return {
    ...toItemWithSources(row, locale),
    reservationCount,
  }
}
