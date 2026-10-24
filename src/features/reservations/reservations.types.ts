import type { ItemStatus } from '../../shared/enums/item-status.js'
import type { Reservation } from '../../db/entities/reservations/reservations.schema.js'

export interface ReservationDetail {
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
  reservation: ReservationDetail
  listItem: ListItemReservationSummary
}

export function toReservationDetail(row: Reservation): ReservationDetail {
  return {
    id: row.id,
    listItemId: row.listItemId,
    userId: row.userId,
    quantityBooked: row.quantityBooked,
    createdAt: row.createdAt,
  }
}
