import { toReservationDetail } from '../../../shared/types/reservation.js'
import { toUserDetail } from '../../../shared/types/user.js'
import type { ReservationDetail, ReservationRowHydrated } from '../../../shared/types/reservation.js'
import type { UserDetail, UserRowWithAvatar } from '../../../shared/types/user.js'

export interface AdminReservationRow extends ReservationRowHydrated {
  user: UserRowWithAvatar | null
}

export interface AdminReservation extends ReservationDetail {
  user: UserDetail | null
}

export function toAdminReservation(row: AdminReservationRow): AdminReservation {
  return {
    ...toReservationDetail(row),
    user: row.user ? toUserDetail(row.user) : null,
  }
}
