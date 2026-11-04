import type { Reservation } from '../../db/entities/reservations/reservations.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { List } from '../../db/entities/lists/lists.schema.js'
import type { ListUser } from '../../db/entities/list-users/list-users.schema.js'
import type { User } from '../../db/entities/users/users.schema.js'
import { ListUserRoles } from '../enums/list-user-role.js'
import { toItemDetail } from './item.js'
import type { ItemDetail, ItemRowWithImage } from './item.js'
import { toUserDetail } from './user.js'
import type { UserDetail } from './user.js'

export interface ReservationListUserWithUser extends ListUser {
  user: User | null
}

export interface ReservationListRow extends List {
  listUsers: ReservationListUserWithUser[]
}

export interface ReservationListItemRow extends ListItem {
  item: ItemRowWithImage
  list: ReservationListRow
}

export interface ReservationRowHydrated extends Reservation {
  listItem: ReservationListItemRow
}

export interface ReservationListItemSummary {
  id: string
  quantityDesired: number
  item: ItemDetail
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
  const ownerUser =
    row.listItem.list.listUsers.find((member) => member.role === ListUserRoles.OWNER)?.user ?? null
  return {
    id: row.id,
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
