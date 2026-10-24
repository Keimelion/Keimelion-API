import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { ItemStatuses } from '../../shared/enums/item-status.js'
import { serviceError } from '../../shared/utils/response.js'
import { findListWithOwner } from '../../db/entities/lists/lists.repository.js'
import {
  findListItemById,
  findListItemByIdForUpdate,
  updateListItemReservationState,
} from '../../db/entities/list-items/list-items.repository.js'
import {
  deleteReservation,
  findReservationByIdForUpdate,
  findReservationByListItemAndUser,
  findReservationsByUserId,
  upsertReservationQuantity,
} from '../../db/entities/reservations/reservations.repository.js'
import { toReservationDetail } from './reservations.types.js'
import type { ItemStatus } from '../../shared/enums/item-status.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type {
  ListItemReservationSummary,
  ReservationActionResponse,
} from './reservations.types.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface CreateReservationInput {
  listItemId: string
  userId: string
  quantityBooked: number
}

export async function createOrUpdateReservation(
  input: CreateReservationInput,
): Promise<ServiceResult<ReservationActionResponse>> {
  const listItem = await findListItemById(input.listItemId)
  if (!listItem) return serviceError(ErrorCode.NOT_FOUND)

  const list = await findListWithOwner(listItem.listId, { excludeDeleted: true })
  if (!list) return serviceError(ErrorCode.NOT_FOUND)

  const ownerUserId = list.collaborators[0]?.userId ?? null
  if (ownerUserId === input.userId) return serviceError(ErrorCode.FORBIDDEN)

  if (input.quantityBooked > listItem.quantityDesired) {
    return serviceError(ErrorCode.UNPROCESSABLE_ENTITY, {
      issues: [
        {
          path: 'quantityBooked',
          code: 'too_big',
          message: `quantityBooked must not exceed quantity_desired (${String(listItem.quantityDesired)})`,
        },
      ],
    })
  }

  return db.transaction(async (tx) => {
    const current = await findListItemByIdForUpdate(input.listItemId, tx)
    if (!current) return serviceError(ErrorCode.NOT_FOUND)

    const existing = await findReservationByListItemAndUser(input.listItemId, input.userId, tx)
    const previousQty = existing?.quantityBooked ?? 0
    const delta = input.quantityBooked - previousQty
    const newTotal = current.quantityReservedTotal + delta

    if (newTotal > current.quantityDesired) return serviceError(ErrorCode.CONFLICT)

    const reservation = await upsertReservationQuantity(
      { listItemId: input.listItemId, userId: input.userId, quantityBooked: input.quantityBooked },
      tx,
    )
    if (!reservation) return serviceError(ErrorCode.INTERNAL_ERROR)

    const nextStatus = computeNextItemStatus(newTotal, current.quantityDesired)
    const updatedListItem = await updateListItemReservationState(
      input.listItemId,
      { quantityReservedTotal: newTotal, itemStatus: nextStatus },
      tx,
    )
    if (!updatedListItem) return serviceError(ErrorCode.INTERNAL_ERROR)

    return {
      data: {
        reservation: toReservationDetail(reservation),
        listItem: toListItemReservationSummary(updatedListItem),
      },
      httpStatus: existing ? HttpStatus.OK : HttpStatus.CREATED,
    }
  })
}

export async function cancelReservation(
  reservationId: string,
  userId: string,
): Promise<ServiceResult<null>> {
  return db.transaction(async (tx) => {
    const reservation = await findReservationByIdForUpdate(reservationId, tx)
    if (!reservation) return serviceError(ErrorCode.NOT_FOUND)
    if (reservation.userId !== userId) return serviceError(ErrorCode.FORBIDDEN)

    const listItem = await findListItemByIdForUpdate(reservation.listItemId, tx)
    if (!listItem) return serviceError(ErrorCode.NOT_FOUND)

    const removed = await deleteReservation(reservationId, tx)
    if (!removed) return serviceError(ErrorCode.INTERNAL_ERROR)

    const newTotal = Math.max(0, listItem.quantityReservedTotal - reservation.quantityBooked)
    const nextStatus = computeNextItemStatus(newTotal, listItem.quantityDesired)
    await updateListItemReservationState(
      reservation.listItemId,
      { quantityReservedTotal: newTotal, itemStatus: nextStatus },
      tx,
    )

    return { data: null, httpStatus: HttpStatus.NO_CONTENT }
  })
}

export async function reconcileListItemsForUserHardDelete(
  userId: string,
  tx: DbTransaction,
): Promise<void> {
  const userReservations = await findReservationsByUserId(userId, tx)
  if (userReservations.length === 0) return

  const totalsByListItem = new Map<string, number>()
  for (const row of userReservations) {
    const previous = totalsByListItem.get(row.listItemId) ?? 0
    totalsByListItem.set(row.listItemId, previous + row.quantityBooked)
  }

  for (const [listItemId, quantityToRelease] of totalsByListItem) {
    const current = await findListItemByIdForUpdate(listItemId, tx)
    if (!current) continue
    const newTotal = Math.max(0, current.quantityReservedTotal - quantityToRelease)
    const nextStatus = computeNextItemStatus(newTotal, current.quantityDesired)
    if (newTotal === current.quantityReservedTotal && nextStatus === current.itemStatus) continue
    await updateListItemReservationState(
      listItemId,
      { quantityReservedTotal: newTotal, itemStatus: nextStatus },
      tx,
    )
  }
}

function computeNextItemStatus(reservedTotal: number, quantityDesired: number): ItemStatus {
  return reservedTotal >= quantityDesired ? ItemStatuses.RESERVED : ItemStatuses.AVAILABLE
}

function toListItemReservationSummary(row: ListItem): ListItemReservationSummary {
  return {
    id: row.id,
    quantityReservedTotal: row.quantityReservedTotal,
    itemStatus: row.itemStatus,
  }
}
