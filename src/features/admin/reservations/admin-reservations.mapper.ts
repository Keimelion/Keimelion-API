import { toReservationDetail } from '../../../shared/types/reservation.js'
import { toUserDetail } from '../../../shared/types/user.js'
import type { ReservationDetail, ReservationRowHydrated } from '../../../shared/types/reservation.js'
import type { User } from '../../../db/entities/users/users.schema.js'
import type { UserDetail } from '../../../shared/types/user.js'

export interface AdminReservationRow extends ReservationRowHydrated {
  user: User
}

export interface AdminReservation extends ReservationDetail {
  user: UserDetail
}

export function toAdminReservation(row: AdminReservationRow): AdminReservation {
  return {
    ...toReservationDetail(row),
    user: toUserDetail(row.user),
  }
}
