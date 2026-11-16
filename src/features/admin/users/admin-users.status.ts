import { and, isNotNull, isNull, not, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { UserStatuses } from '@keimelion/sdk/enums'
import type { UserStatus } from '@keimelion/sdk/enums'
import { users } from '../../../db/entities/users/users.schema.js'
import type { User } from '../../../db/entities/users/users.schema.js'

const USER_INACTIVITY_THRESHOLD_MONTHS = 12

export type UserStatusFields = Pick<
  User,
  'deletedAt' | 'bannedAt' | 'activatedAt' | 'emailVerifiedAt' | 'lastActiveAt' | 'createdAt'
>

interface UserStatusRule {
  status: UserStatus
  matches: (user: UserStatusFields, now: Date) => boolean
  condition: SQL
}

// Single source of the status rules: the mapper reads `matches`, the list filter reads `condition`,
// so both must stay equivalent. Ordered by precedence; an account matching no rule is active.
const USER_STATUS_RULES: readonly UserStatusRule[] = [
  {
    status: UserStatuses.PENDING_DELETION,
    matches: (user) => user.deletedAt !== null,
    condition: isNotNull(users.deletedAt),
  },
  {
    status: UserStatuses.BANNED,
    matches: (user) => user.bannedAt !== null,
    condition: isNotNull(users.bannedAt),
  },
  {
    status: UserStatuses.INVITED,
    matches: (user) => user.activatedAt === null,
    condition: isNull(users.activatedAt),
  },
  {
    status: UserStatuses.UNVERIFIED,
    matches: (user) => user.emailVerifiedAt === null,
    condition: isNull(users.emailVerifiedAt),
  },
  {
    status: UserStatuses.INACTIVE,
    matches: (user, now) =>
      (user.lastActiveAt ?? user.createdAt) < subtractMonths(now, USER_INACTIVITY_THRESHOLD_MONTHS),
    condition: sql`COALESCE(${users.lastActiveAt}, ${users.createdAt}) < now() - make_interval(months => ${USER_INACTIVITY_THRESHOLD_MONTHS})`,
  },
]

export function deriveUserStatus(user: UserStatusFields, now: Date): UserStatus {
  return USER_STATUS_RULES.find((rule) => rule.matches(user, now))?.status ?? UserStatuses.ACTIVE
}

export function buildUserStatusCondition(status: UserStatus): SQL | undefined {
  const ruleIndex = USER_STATUS_RULES.findIndex((rule) => rule.status === status)
  const precedingRules = ruleIndex === -1 ? USER_STATUS_RULES : USER_STATUS_RULES.slice(0, ruleIndex)
  return and(
    ...precedingRules.map((rule) => not(rule.condition)),
    USER_STATUS_RULES[ruleIndex]?.condition,
  )
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() - months)
  return result
}
