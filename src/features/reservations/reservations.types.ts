import type { ItemStatus } from '../../shared/enums/item-status.js'
import type { Reservation } from '../../db/entities/reservations/reservations.schema.js'

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
