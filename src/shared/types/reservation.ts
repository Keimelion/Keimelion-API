import type { Reservation } from '../../db/entities/reservations/reservations.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { List } from '../../db/entities/lists/lists.schema.js'
import { findOwnerUser } from './list.js'
import type { ListUserWithUser } from './list.js'
import { toItemDetail } from './item.js'
import type { ItemRowWithImage } from './item.js'
import { toUserDetail } from './user.js'
import type { ReservationDetailParsed, ReservationListItemSummaryParsed, ReservationListSummaryParsed } from '@keimelion/sdk/schemas'

export interface ReservationListRow extends List {
  listUsers: ListUserWithUser[]
}

export interface ReservationListItemRow extends ListItem {
  item: ItemRowWithImage
  list: ReservationListRow
}

export interface ReservationRowHydrated extends Reservation {
  listItem: ReservationListItemRow
}

export type ReservationListItemSummary = ReservationListItemSummaryParsed

export type ReservationListSummary = ReservationListSummaryParsed

export type ReservationDetail = ReservationDetailParsed

export function toReservationDetail(row: ReservationRowHydrated): ReservationDetail {
  const ownerUser = findOwnerUser(row.listItem.list.listUsers)
  return {
    id: row.id,
    reserverName: row.reserverName,
    reserverEmail: row.reserverEmail,
    quantityBooked: row.quantityBooked,
    createdAt: row.createdAt,
    listItem: {
      id: row.listItem.id,
      quantityDesired: row.listItem.quantityDesired,
      item: toItemDetail(row.listItem.item),
    },
    list: {
      id: row.listItem.list.id,
      slug: row.listItem.list.slug,
      title: row.listItem.list.title,
      owner: ownerUser ? toUserDetail(ownerUser) : null,
    },
  }
}
