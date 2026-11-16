import { STAFF_ROLE_VALUES } from '@keimelion/sdk/enums'
import type { StaffRole, UserRole } from '@keimelion/sdk/enums'

export function isStaffRole(role: UserRole): role is StaffRole {
  return STAFF_ROLE_VALUES.some((staffRole) => staffRole === role)
}
