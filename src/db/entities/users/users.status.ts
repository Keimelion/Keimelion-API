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

export function computeInactivityThreshold(now: Date): Date {
  return subtractMonths(now, USER_INACTIVITY_THRESHOLD_MONTHS)
}

// A fresh lastActiveAt only clears the inactive status: every status ranked above it ignores
// lastActiveAt, so the full computation is not needed (nor the row) on the hot activity path.
export function buildStatusAfterActivity(): SQL<UserStatus> {
  return sql<UserStatus>`CASE WHEN ${users.userStatus} = ${UserStatuses.INACTIVE} THEN ${UserStatuses.ACTIVE}::user_status ELSE ${users.userStatus} END`
}

interface StatusOnActionInput {
  activatesAccount?: boolean
  verifiesEmail?: boolean
}

// Verifying an email or setting a password is an account activity: lastActiveAt is bumped in the
// same statement, so the inactive status cannot apply. The status is computed from the row as it
// stands at write time, never from an earlier read, so a concurrent ban or soft delete is kept.
export function buildStatusOnAction(input: StatusOnActionInput): SQL<UserStatus> {
  const invitedBranch = input.activatesAccount
    ? sql.empty()
    : sql` WHEN ${users.activatedAt} IS NULL THEN ${UserStatuses.INVITED}::user_status`
  const unverifiedBranch = input.verifiesEmail
    ? sql.empty()
    : sql` WHEN ${users.emailVerifiedAt} IS NULL THEN ${UserStatuses.UNVERIFIED}::user_status`
  return sql<UserStatus>`CASE WHEN ${users.deletedAt} IS NOT NULL THEN ${UserStatuses.PENDING_DELETION}::user_status WHEN ${users.bannedAt} IS NOT NULL THEN ${UserStatuses.BANNED}::user_status${invitedBranch}${unverifiedBranch} ELSE ${UserStatuses.ACTIVE}::user_status END`
}
