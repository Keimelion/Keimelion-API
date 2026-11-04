import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { ItemStatuses } from '../../shared/enums/item-status.js'
import { findOwnerUser, isListOwner } from '../../shared/types/list.js'
import { toReservationDetail } from '../../shared/types/reservation.js'
import { serviceError } from '../../shared/utils/response.js'
import { logger } from '../../shared/utils/logger.js'
import { findListWithOwner } from '../../db/entities/lists/lists.repository.js'
import {
  findListItemById,
  findListItemByIdForUpdate,
  findListItemOwnerUserId,
  updateListItemReservationState,
} from '../../db/entities/list-items/list-items.repository.js'
import {
  deleteReservation,
  findNamedReservationDuplicate,
  findReservationByIdForUpdate,
  findReservationByIdWithListItem,
  findReservationByListItemAndUser,
  findReservationsByUserId,
  insertNamedReservation,
  upsertReservationQuantity,
} from '../../db/entities/reservations/reservations.repository.js'
import { toReservationSummary } from './reservations.types.js'
import { generateReservationToken, isReservationTokenMatch } from './reservations.token.js'
import type { ItemStatus } from '../../shared/enums/item-status.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { Reservation } from '../../db/entities/reservations/reservations.schema.js'
import type { ListUserWithUser } from '../../shared/types/list.js'
import type { ReservationDetail } from '../../shared/types/reservation.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type {
  AnonymousReservationActionResponse,
  ListItemReservationSummary,
  ReservationActionResponse,
} from './reservations.types.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const ReservationModes = {
  SELF: 'self',
  PROXY: 'proxy',
  ANONYMOUS: 'anonymous',
} as const

type ReservationIntent =
  | { mode: typeof ReservationModes.SELF; userId: string }
  | { mode: typeof ReservationModes.PROXY; ownerUserId: string; reserverName: string }
  | { mode: typeof ReservationModes.ANONYMOUS; reserverName: string }

const ReservationAccessLevels = {
  HOLDER: 'holder',
  LIST_OWNER: 'list_owner',
} as const

type ReservationAccessLevel = (typeof ReservationAccessLevels)[keyof typeof ReservationAccessLevels]

type ReservationPermission = { accessLevel: ReservationAccessLevel } | { errorCode: ErrorCode }

type NamedReservationOutcome = ReservationActionResponse | ErrorCode

export interface CreateReservationInput {
  listItemId: string
  authUserId: string | null
  reserverName: string | null
  reserverEmail: string | null
  quantityBooked: number
}

export interface ReservationCaller {
  authUserId: string | null
  rawReservationToken: string | null
}

interface NamedReservationValues {
  listItemId: string
  quantityBooked: number
  reserverName: string
  reserverEmail: string | null
  anonymousTokenHash: string | null
}

interface ReservationTotals {
  listItemId: string
  newTotal: number
  quantityDesired: number
}

interface ReservationPermissionTarget {
  reservation: Reservation
  ownerUserId: string | null
}

interface CancelOutcome {
  result: ServiceResult<null>
  ownerCancelledReservation: Reservation | null
}

export async function createOrUpdateReservation(
  input: CreateReservationInput,
): Promise<ServiceResult<ReservationActionResponse | AnonymousReservationActionResponse>> {
  const listItem = await findListItemById(input.listItemId)
  if (!listItem) return serviceError(ErrorCode.NOT_FOUND)

  const list = await findListWithOwner(listItem.listId, { excludeDeleted: true })
  if (!list) return serviceError(ErrorCode.NOT_FOUND)

  const intent = resolveReservationIntent(input, list.listUsers)
  if (typeof intent === 'string') return serviceError(intent)

  if (input.quantityBooked > listItem.quantityDesired) {
    return quantityExceedsDesiredError(listItem.quantityDesired)
  }

  switch (intent.mode) {
    case ReservationModes.SELF:
      return reserveForSelf(input, intent.userId)
    case ReservationModes.PROXY:
      return reserveAsProxy(input, intent.ownerUserId, intent.reserverName)
    case ReservationModes.ANONYMOUS:
      return reserveAnonymously(input, intent.reserverName)
  }
}

export async function getReservation(
  reservationId: string,
  caller: ReservationCaller,
): Promise<ServiceResult<{ reservation: ReservationDetail }>> {
  const row = await findReservationByIdWithListItem(reservationId)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  const ownerUserId = findOwnerUser(row.listItem.list.listUsers)?.id ?? null
  const permission = resolveReservationPermission({ reservation: row, ownerUserId }, caller)
  if ('errorCode' in permission) return serviceError(permission.errorCode)

  return { data: { reservation: toReservationDetail(row) }, httpStatus: HttpStatus.OK }
}

export async function cancelReservation(
  reservationId: string,
  caller: ReservationCaller,
): Promise<ServiceResult<null>> {
  const { result, ownerCancelledReservation } = await db.transaction<CancelOutcome>(async (tx) => {
    const reservation = await findReservationByIdForUpdate(reservationId, tx)
    if (!reservation) return { result: serviceError(ErrorCode.NOT_FOUND), ownerCancelledReservation: null }

    const ownerUserId = await findListItemOwnerUserId(reservation.listItemId, tx)
    const permission = resolveReservationPermission({ reservation, ownerUserId }, caller)
    if ('errorCode' in permission) {
      return { result: serviceError(permission.errorCode), ownerCancelledReservation: null }
    }

    const outcome = await cancelReservationAtomic(tx, reservation)
    const isOwnerCancel = permission.accessLevel === ReservationAccessLevels.LIST_OWNER
    return { result: outcome, ownerCancelledReservation: isOwnerCancel ? reservation : null }
  })

  if (ownerCancelledReservation && result.httpStatus === HttpStatus.NO_CONTENT) {
    logOwnerCancel(caller.authUserId, ownerCancelledReservation)
  }
  return result
}

/**
 * Shared cancel primitive — assumes the caller has already SELECT ... FOR UPDATE'd
 * the reservation and performed any ownership check. Locks the parent list_item,
 * deletes the reservation and reconciles quantity_reserved_total + item_status.
 */
export async function cancelReservationAtomic(
  tx: DbTransaction,
  reservation: Reservation,
): Promise<ServiceResult<null>> {
  const listItem = await findListItemByIdForUpdate(reservation.listItemId, tx)
  if (!listItem) return serviceError(ErrorCode.NOT_FOUND)

  const removed = await deleteReservation(reservation.id, tx)
  if (!removed) return serviceError(ErrorCode.INTERNAL_ERROR)

  const newTotal = Math.max(0, listItem.quantityReservedTotal - reservation.quantityBooked)
  await applyReservationTotal(
    { listItemId: reservation.listItemId, newTotal, quantityDesired: listItem.quantityDesired },
    tx,
  )

  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
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
    if (newTotal === current.quantityReservedTotal) continue
    await applyReservationTotal({ listItemId, newTotal, quantityDesired: current.quantityDesired }, tx)
  }
}

function resolveReservationIntent(
  input: CreateReservationInput,
  listUsers: readonly ListUserWithUser[],
): ReservationIntent | ErrorCode {
  if (input.authUserId === null) {
    if (input.reserverName === null) return ErrorCode.RESERVATION_REQUIRES_RESERVER_NAME
    return { mode: ReservationModes.ANONYMOUS, reserverName: input.reserverName }
  }
  if (input.reserverName === null) return { mode: ReservationModes.SELF, userId: input.authUserId }
  if (!isListOwner(listUsers, input.authUserId)) return ErrorCode.RESERVATION_INCONSISTENT_INTENT
  return {
    mode: ReservationModes.PROXY,
    ownerUserId: input.authUserId,
    reserverName: input.reserverName,
  }
}

function quantityExceedsDesiredError(quantityDesired: number): ServiceResult<never> {
  return serviceError(ErrorCode.UNPROCESSABLE_ENTITY, {
    issues: [
      {
        path: 'quantityBooked',
        code: 'too_big',
        message: `quantityBooked must not exceed quantity_desired (${String(quantityDesired)})`,
      },
    ],
  })
}

async function reserveForSelf(
  input: CreateReservationInput,
  userId: string,
): Promise<ServiceResult<ReservationActionResponse>> {
  return db.transaction(async (tx) => {
    const current = await findListItemByIdForUpdate(input.listItemId, tx)
    if (!current) return serviceError(ErrorCode.NOT_FOUND)

    const existing = await findReservationByListItemAndUser(input.listItemId, userId, tx)
    const previousQuantity = existing?.quantityBooked ?? 0
    const newTotal = current.quantityReservedTotal + input.quantityBooked - previousQuantity
    if (newTotal > current.quantityDesired) return serviceError(ErrorCode.CONFLICT)

    const reservation = await upsertReservationQuantity(
      { listItemId: input.listItemId, userId, quantityBooked: input.quantityBooked },
      tx,
    )
    const totals = { listItemId: input.listItemId, newTotal, quantityDesired: current.quantityDesired }
    const response = await summarizeReservation(tx, reservation, totals)
    if (!response) return serviceError(ErrorCode.INTERNAL_ERROR)

    return { data: response, httpStatus: existing ? HttpStatus.OK : HttpStatus.CREATED }
  })
}

async function reserveAsProxy(
  input: CreateReservationInput,
  ownerUserId: string,
  reserverName: string,
): Promise<ServiceResult<ReservationActionResponse>> {
  const values = toNamedReservationValues(input, reserverName, null)
  const outcome = await db.transaction<NamedReservationOutcome>(async (tx) => {
    const current = await findListItemByIdForUpdate(input.listItemId, tx)
    if (!current) return ErrorCode.NOT_FOUND
    return insertNamedReservationOnLockedItem(tx, current, values)
  })
  if (typeof outcome === 'string') return serviceError(outcome)

  logger.info({
    event: 'owner_proxy_create_reservation',
    ownerUserId,
    reservationId: outcome.reservation.id,
    listItemId: input.listItemId,
    reserverName,
  })
  return { data: outcome, httpStatus: HttpStatus.CREATED }
}

async function reserveAnonymously(
  input: CreateReservationInput,
  reserverName: string,
): Promise<ServiceResult<AnonymousReservationActionResponse>> {
  const { rawToken, tokenHash } = generateReservationToken()
  const values = toNamedReservationValues(input, reserverName, tokenHash)
  const outcome = await db.transaction<NamedReservationOutcome>(async (tx) => {
    const current = await findListItemByIdForUpdate(input.listItemId, tx)
    if (!current) return ErrorCode.NOT_FOUND

    const duplicate = await findNamedReservationDuplicate(values, tx)
    if (duplicate) return ErrorCode.CONFLICT

    return insertNamedReservationOnLockedItem(tx, current, values)
  })
  if (typeof outcome === 'string') return serviceError(outcome)

  return { data: { ...outcome, token: rawToken }, httpStatus: HttpStatus.CREATED }
}

function toNamedReservationValues(
  input: CreateReservationInput,
  reserverName: string,
  anonymousTokenHash: string | null,
): NamedReservationValues {
  return {
    listItemId: input.listItemId,
    quantityBooked: input.quantityBooked,
    reserverName,
    reserverEmail: input.reserverEmail,
    anonymousTokenHash,
  }
}

async function insertNamedReservationOnLockedItem(
  tx: DbTransaction,
  current: ListItem,
  values: NamedReservationValues,
): Promise<NamedReservationOutcome> {
  const newTotal = current.quantityReservedTotal + values.quantityBooked
  if (newTotal > current.quantityDesired) return ErrorCode.CONFLICT

  const reservation = await insertNamedReservation(values, tx)
  const totals = { listItemId: current.id, newTotal, quantityDesired: current.quantityDesired }
  const response = await summarizeReservation(tx, reservation, totals)
  return response ?? ErrorCode.INTERNAL_ERROR
}

async function summarizeReservation(
  tx: DbTransaction,
  reservation: Reservation | undefined,
  totals: ReservationTotals,
): Promise<ReservationActionResponse | null> {
  if (!reservation) return null
  const updatedListItem = await applyReservationTotal(totals, tx)
  if (!updatedListItem) return null
  return {
    reservation: toReservationSummary(reservation),
    listItem: toListItemReservationSummary(updatedListItem),
  }
}

function resolveReservationPermission(
  target: ReservationPermissionTarget,
  caller: ReservationCaller,
): ReservationPermission {
  const { reservation, ownerUserId } = target
  if (caller.authUserId !== null) {
    if (reservation.userId === caller.authUserId) return { accessLevel: ReservationAccessLevels.HOLDER }
    if (ownerUserId === caller.authUserId) return { accessLevel: ReservationAccessLevels.LIST_OWNER }
    return { errorCode: ErrorCode.FORBIDDEN }
  }
  if (caller.rawReservationToken === null) return { errorCode: ErrorCode.FORBIDDEN }
  if (!isAnonymousHolder(reservation, caller.rawReservationToken)) {
    return { errorCode: ErrorCode.RESERVATION_TOKEN_INVALID }
  }
  return { accessLevel: ReservationAccessLevels.HOLDER }
}

function isAnonymousHolder(reservation: Reservation, rawReservationToken: string): boolean {
  if (reservation.anonymousTokenHash === null) return false
  return isReservationTokenMatch(rawReservationToken, reservation.anonymousTokenHash)
}

function logOwnerCancel(ownerUserId: string | null, reservation: Reservation): void {
  logger.info({
    event: 'owner_cancel_reservation',
    ownerUserId,
    reservationId: reservation.id,
    listItemId: reservation.listItemId,
    reserverName: reservation.reserverName,
  })
}

async function applyReservationTotal(
  totals: ReservationTotals,
  tx: DbTransaction,
): Promise<ListItem | undefined> {
  const nextStatus = computeNextItemStatus(totals.newTotal, totals.quantityDesired)
  return updateListItemReservationState(
    totals.listItemId,
    { quantityReservedTotal: totals.newTotal, itemStatus: nextStatus },
    tx,
  )
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
