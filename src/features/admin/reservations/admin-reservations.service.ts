import { db } from '../../../db/client.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import { cancelReservationAtomic } from '../../reservations/reservations.service.js'
import { findReservationByIdForUpdate } from '../../../db/entities/reservations/reservations.repository.js'
import { AdminAction } from '../admin.enums.js'
import {
  countReservations,
  findReservationByIdHydrated,
  findReservationsPaged,
} from './admin-reservations.repository.js'
import { toAdminReservation } from './admin-reservations.mapper.js'
import type { AdminReservation } from './admin-reservations.mapper.js'
import type {
  AdminReservationsFilters,
  AdminReservationsSortField,
} from './admin-reservations.repository.js'
import type { Reservation } from '../../../db/entities/reservations/reservations.schema.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'

export interface ListReservationsInput extends PaginationInput {
  userId?: string | undefined
  listItemId?: string | undefined
  listId?: string | undefined
  sort?: SortInput<AdminReservationsSortField> | undefined
}

export async function listReservations(
  input: ListReservationsInput,
): Promise<ServiceResult<PaginatedResponse<AdminReservation>>> {
  const filters: AdminReservationsFilters = {
    userId: input.userId,
    listItemId: input.listItemId,
    listId: input.listId,
  }
  const [rows, total] = await Promise.all([
    findReservationsPaged(filters, input, input.sort),
    countReservations(filters),
  ])

  return {
    data: buildPaginatedResponse(rows.map(toAdminReservation), input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function getReservationById(
  id: string,
): Promise<ServiceResult<{ reservation: AdminReservation }>> {
  const row = await findReservationByIdHydrated(id)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  return {
    data: { reservation: toAdminReservation(row) },
    httpStatus: HttpStatus.OK,
  }
}

interface AdminCancelOutcome {
  result: ServiceResult<null>
  reservation: Reservation | null
}

export async function cancelReservationByAdmin(
  adminId: string,
  reservationId: string,
): Promise<ServiceResult<null>> {
  const { result, reservation } = await db.transaction<AdminCancelOutcome>(async (tx) => {
    const found = await findReservationByIdForUpdate(reservationId, tx)
    if (!found) return { result: serviceError(ErrorCode.NOT_FOUND), reservation: null }
    const outcome = await cancelReservationAtomic(tx, found)
    return { result: outcome, reservation: found }
  })

  if (result.httpStatus !== HttpStatus.NO_CONTENT || reservation === null) {
    return result
  }

  logger.warn({
    adminId,
    action: AdminAction.DELETE_RESERVATION,
    reservationId: reservation.id,
    listItemId: reservation.listItemId,
    reserverUserId: reservation.userId,
  })
  return result
}
