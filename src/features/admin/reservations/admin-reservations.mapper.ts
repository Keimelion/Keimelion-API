import { toReservationDetail } from '../../../shared/types/reservation.js'
import { toUserDetail } from '../../../shared/types/user.js'
import type { ReservationRowHydrated } from '../../../shared/types/reservation.js'
import type { UserRowWithAvatar } from '../../../shared/types/user.js'
import type { AdminReservationDetailParsed } from '@keimelion/sdk/schemas'

export interface AdminReservationRow extends ReservationRowHydrated {
  user: UserRowWithAvatar | null
}

export type AdminReservation = AdminReservationDetailParsed

export function toAdminReservation(row: AdminReservationRow): AdminReservation {
  return {
    ...toReservationDetail(row),
    user: row.user ? toUserDetail(row.user) : null,
  }
}
