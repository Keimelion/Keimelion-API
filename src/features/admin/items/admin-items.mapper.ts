import { toItemWithSources } from '../../../shared/types/item.js'
import type { ItemRowWithSources } from '../../../shared/types/item.js'
import type { Locale } from '@keimelion/sdk/enums'
import type { AdminItemDetailParsed } from '@keimelion/sdk/schemas'

export type AdminItem = AdminItemDetailParsed

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
