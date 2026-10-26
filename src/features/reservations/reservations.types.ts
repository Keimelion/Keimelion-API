import type { ItemStatus } from '../../shared/enums/item-status.js'
import type { Reservation } from '../../db/entities/reservations/reservations.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { List } from '../../db/entities/lists/lists.schema.js'
import type { Item } from '../../db/entities/items/items.schema.js'
import type { ListCollaborator } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import type { User } from '../../db/entities/users/users.schema.js'

export interface ReservationSummary {
  id: string
  listItemId: string
  userId: string
  quantityBooked: number
  createdAt: Date
}

export interface ListItemReservationSummary {
  id: string
  quantityReservedTotal: number
  itemStatus: ItemStatus
}

export interface ReservationActionResponse {
  reservation: ReservationSummary
  listItem: ListItemReservationSummary
}

export function toReservationSummary(row: Reservation): ReservationSummary {
  return {
    id: row.id,
    listItemId: row.listItemId,
    userId: row.userId,
    quantityBooked: row.quantityBooked,
    createdAt: row.createdAt,
  }
}

export interface ReservationProfileCollaboratorRow extends ListCollaborator {
  user: User | null
}

export interface ReservationProfileListRow extends List {
  collaborators: ReservationProfileCollaboratorRow[]
}

export interface ReservationProfileListItemRow extends ListItem {
  item: Item
  list: ReservationProfileListRow
}

export interface ReservationProfileRow extends Reservation {
  listItem: ReservationProfileListItemRow
}

export interface ReservationProfileEntry {
  reservation: {
    id: string
    quantityBooked: number
    createdAt: Date
  }
  listItem: {
    id: string
    name: string
    quantityDesired: number
    imageId: string | null
  }
  list: {
    id: string
    slug: string
    title: string
    ownerDisplayName: string | null
  }
}

export function toReservationProfileEntry(row: ReservationProfileRow): ReservationProfileEntry {
  const ownerUser = row.listItem.list.collaborators[0]?.user ?? null
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
      imageId: row.listItem.imageId ?? null,
    },
    list: {
      id: row.listItem.list.id,
      slug: row.listItem.list.slug,
      title: row.listItem.list.title,
      ownerDisplayName: ownerUser?.username ?? null,
    },
  }
}
