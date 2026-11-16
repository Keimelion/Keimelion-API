import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { UserStatuses } from '@keimelion/sdk/enums'
import type { UserStatus } from '@keimelion/sdk/enums'
import { subtractMonths } from '../../../shared/utils/time.js'
import { users } from './users.schema.js'
import type { User } from './users.schema.js'

export const USER_INACTIVITY_THRESHOLD_MONTHS = 12

export type UserStatusFields = Pick<
  User,
  'deletedAt' | 'bannedAt' | 'activatedAt' | 'emailVerifiedAt' | 'lastActiveAt' | 'createdAt'
>

export const NEW_ACCOUNT_STATUS_FIELDS = {
  deletedAt: null,
  bannedAt: null,
  lastActiveAt: null,
} as const satisfies Partial<UserStatusFields>

// users.user_status is stored: every write that changes one of these fields stores the result in the
// same statement. Checks follow the status precedence.
export function computeUserStatus(user: UserStatusFields, now: Date): UserStatus {
  if (user.deletedAt !== null) return UserStatuses.PENDING_DELETION
  if (user.bannedAt !== null) return UserStatuses.BANNED
  if (user.activatedAt === null) return UserStatuses.INVITED
  if (user.emailVerifiedAt === null) return UserStatuses.UNVERIFIED
  if ((user.lastActiveAt ?? user.createdAt) < computeInactivityThreshold(now)) return UserStatuses.INACTIVE
  return UserStatuses.ACTIVE
}

export function withUserStatus<TChanges extends Partial<UserStatusFields>>(
  current: UserStatusFields,
  changes: TChanges,
  now: Date,
): TChanges & { userStatus: UserStatus } {
  return { ...changes, userStatus: computeUserStatus({ ...current, ...changes }, now) }
}

export function computeInactivityThreshold(now: Date): Date {
  return subtractMonths(now, USER_INACTIVITY_THRESHOLD_MONTHS)
}

// A fresh lastActiveAt only clears the inactive status: every status ranked above it ignores
// lastActiveAt, so the full computation is not needed (nor the row) on the hot activity path.
export function buildStatusAfterActivity(): SQL<UserStatus> {
  return sql<UserStatus>`CASE WHEN ${users.userStatus} = ${UserStatuses.INACTIVE} THEN ${UserStatuses.ACTIVE}::user_status ELSE ${users.userStatus} END`
}
