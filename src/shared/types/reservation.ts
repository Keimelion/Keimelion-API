import type { Reservation } from '../../db/entities/reservations/reservations.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { List } from '../../db/entities/lists/lists.schema.js'
import type { Item } from '../../db/entities/items/items.schema.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { ListCollaborator } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import type { User } from '../../db/entities/users/users.schema.js'
import { toUserDetail } from './user.js'
import type { UserDetail } from './user.js'
import { toImageDetail } from '../../features/uploads/images.mapper.js'
import type { ImageDetail } from '../../features/uploads/images.mapper.js'

export interface ReservationListCollaboratorWithUser extends ListCollaborator {
  user: User | null
}

export interface ReservationListRow extends List {
  collaborators: ReservationListCollaboratorWithUser[]
}

export interface ReservationListItemRow extends ListItem {
  item: Item
  image: Image | null
  list: ReservationListRow
}

export interface ReservationRowHydrated extends Reservation {
  listItem: ReservationListItemRow
}

export interface ReservationListItemSummary {
  id: string
  name: string
  quantityDesired: number
  image: ImageDetail | null
}

export interface ReservationListSummary {
  id: string
  slug: string
  title: string
  owner: UserDetail | null
}

export interface ReservationDetail {
  id: string
  quantityBooked: number
  createdAt: Date
  listItem: ReservationListItemSummary
  list: ReservationListSummary
}

export function toReservationDetail(row: ReservationRowHydrated): ReservationDetail {
  const ownerUser = row.listItem.list.collaborators[0]?.user ?? null
  return {
    id: row.id,
    quantityBooked: row.quantityBooked,
    createdAt: row.createdAt,
    listItem: {
      id: row.listItem.id,
      name: row.listItem.item.name,
      quantityDesired: row.listItem.quantityDesired,
      image: row.listItem.image ? toImageDetail(row.listItem.image) : null,
    },
    list: {
      id: row.listItem.list.id,
      slug: row.listItem.list.slug,
      title: row.listItem.list.title,
      owner: ownerUser ? toUserDetail(ownerUser) : null,
    },
  }
}
