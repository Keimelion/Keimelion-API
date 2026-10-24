import { toItemWithSources } from '../../../shared/types/item.js'
import type { ItemRowWithSources, ItemWithSources } from '../../../shared/types/item.js'
import type { Locale } from '../../../shared/enums/locale.js'
import { toAdminReservation } from '../reservations/admin-reservations.mapper.js'
import type {
  AdminReservation,
  AdminReservationRow,
} from '../reservations/admin-reservations.mapper.js'

export interface AdminItem extends ItemWithSources {
  reservationCount: number
}

export interface AdminItemDetail extends AdminItem {
  reservations: AdminReservation[]
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

export function toAdminItemDetail(
  row: ItemRowWithSources,
  locale: Locale,
  reservationRows: AdminReservationRow[],
): AdminItemDetail {
  return {
    ...toAdminItem(row, locale, reservationRows.length),
    reservations: reservationRows.map(toAdminReservation),
  }
}
