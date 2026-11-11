import type { Reservation } from '../../db/entities/reservations/reservations.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { List } from '../../db/entities/lists/lists.schema.js'
import type { ItemRowWithImage } from '../../shared/types/item.js'
import { toImageDetail } from '../uploads/images.mapper.js'
import { findOwnerUser } from '../../shared/types/list.js'
import type { ListUserWithUser } from '../../shared/types/list.js'
import type { ListItemReservationSummaryParsed, ReservationsCreateResponseParsed, ReservationSummaryParsed, UserReservationSummaryParsed } from '@keimelion/sdk/schemas'

export type ReservationSummary = ReservationSummaryParsed

export type ListItemReservationSummary = ListItemReservationSummaryParsed

export type ReservationActionResponse = Omit<ReservationsCreateResponseParsed, 'token'>

export interface AnonymousReservationActionResponse extends ReservationActionResponse {
  token: string
}

export function toReservationSummary(row: Reservation): ReservationSummary {
  return {
    id: row.id,
    listItemId: row.listItemId,
    userId: row.userId,
    reserverName: row.reserverName,
    reserverEmail: row.reserverEmail,
    quantityBooked: row.quantityBooked,
    createdAt: row.createdAt,
  }
}

export interface ReservationProfileListRow extends List {
  listUsers: ListUserWithUser[]
}

export interface ReservationProfileListItemRow extends ListItem {
  item: ItemRowWithImage
  list: ReservationProfileListRow
}

export interface ReservationProfileRow extends Reservation {
  listItem: ReservationProfileListItemRow
}

export type ReservationProfileEntry = UserReservationSummaryParsed

export function toReservationProfileEntry(row: ReservationProfileRow): ReservationProfileEntry {
  const ownerUser = findOwnerUser(row.listItem.list.listUsers)
  return {
    reservation: {
      id: row.id,
      quantityBooked: row.quantityBooked,
      createdAt: row.createdAt,
    },
    listItem: {
      id: row.listItem.id,
      name: row.listItem.item.name,
      quantityDesired: row.listItem.quantityDesired,
      imageId: row.listItem.item.imageId ?? null,
      image: row.listItem.item.image ? toImageDetail(row.listItem.item.image) : null,
    },
    list: {
      id: row.listItem.list.id,
      slug: row.listItem.list.slug,
      title: row.listItem.list.title,
      ownerDisplayName: ownerUser?.username ?? null,
    },
  }
}
