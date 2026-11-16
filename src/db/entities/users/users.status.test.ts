import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { UserStatuses } from '@keimelion/sdk/enums'
import type { UserStatus } from '@keimelion/sdk/enums'
import {
  USER_INACTIVITY_THRESHOLD_MONTHS,
  buildStatusAfterActivity,
  buildStatusOnAction,
  computeInactivityThreshold,
  computeUserStatus,
} from './users.status.js'
import type { UserStatusFields } from './users.status.js'

const NOW = new Date('2026-11-16T12:00:00Z')
const ELEVEN_MONTHS_AGO = new Date('2025-12-16T12:00:00Z')
const THIRTEEN_MONTHS_AGO = new Date('2025-10-16T12:00:00Z')

const ACTIVE_FIELDS: UserStatusFields = {
  deletedAt: null,
  bannedAt: null,
  activatedAt: ELEVEN_MONTHS_AGO,
  emailVerifiedAt: ELEVEN_MONTHS_AGO,
  lastActiveAt: ELEVEN_MONTHS_AGO,
  createdAt: THIRTEEN_MONTHS_AGO,
}

function buildAllFieldCombinations(): UserStatusFields[] {
  const dateOrNull = [null, NOW] as const
  const lastSeen = [null, ELEVEN_MONTHS_AGO, THIRTEEN_MONTHS_AGO] as const
  const createdAt = [ELEVEN_MONTHS_AGO, THIRTEEN_MONTHS_AGO] as const
  return dateOrNull.flatMap((deletedAt) =>
    dateOrNull.flatMap((bannedAt) =>
      dateOrNull.flatMap((activatedAt) =>
        dateOrNull.flatMap((emailVerifiedAt) =>
          lastSeen.flatMap((lastActiveAt) =>
            createdAt.map((created) => ({
              deletedAt,
              bannedAt,
              activatedAt,
              emailVerifiedAt,
              lastActiveAt,
              createdAt: created,
            })),
          ),
        ),
      ),
    ),
  )
}

describe('computeUserStatus', () => {
  it.each<[string, Partial<UserStatusFields>, UserStatus]>([
    ['a soft-deleted account, whatever else it matches', { deletedAt: NOW, bannedAt: NOW, activatedAt: null }, UserStatuses.PENDING_DELETION],
    ['a banned account still pending its invitation', { bannedAt: NOW, activatedAt: null }, UserStatuses.BANNED],
    ['a staff account that never set a password', { activatedAt: null, emailVerifiedAt: null, lastActiveAt: null }, UserStatuses.INVITED],
    ['an activated account with an unverified email', { emailVerifiedAt: null, lastActiveAt: THIRTEEN_MONTHS_AGO }, UserStatuses.UNVERIFIED],
    ['an account last active more than 12 months ago', { lastActiveAt: THIRTEEN_MONTHS_AGO }, UserStatuses.INACTIVE],
    ['an account never active, created more than 12 months ago', { lastActiveAt: null }, UserStatuses.INACTIVE],
    ['an account never active, created less than 12 months ago', { lastActiveAt: null, createdAt: ELEVEN_MONTHS_AGO }, UserStatuses.ACTIVE],
    ['an account active within the last 12 months', {}, UserStatuses.ACTIVE],
  ])('reports %s', (_label, overrides, expected) => {
    expect(computeUserStatus({ ...ACTIVE_FIELDS, ...overrides }, NOW)).toBe(expected)
  })

  it('stores pending_deletion for any soft-deleted account, so a soft delete needs no other field', () => {
    const softDeleted = buildAllFieldCombinations().filter((fields) => fields.deletedAt !== null)

    expect(new Set(softDeleted.map((fields) => computeUserStatus(fields, NOW)))).toEqual(
      new Set([UserStatuses.PENDING_DELETION]),
    )
  })
})

describe('computeInactivityThreshold', () => {
  it('goes back the 12-month inactivity threshold', () => {
    expect(USER_INACTIVITY_THRESHOLD_MONTHS).toBe(12)
    expect(computeInactivityThreshold(NOW)).toEqual(new Date('2025-11-16T12:00:00Z'))
  })
})

describe('buildStatusOnAction', () => {
  const dialect = new PgDialect()

  it('activates an account: deletion and ban still rank first, then the email verification', () => {
    const query = dialect.sqlToQuery(buildStatusOnAction({ activatesAccount: true }))

    expect(query.sql).toBe(
      'CASE WHEN "users"."deleted_at" IS NOT NULL THEN $1::user_status WHEN "users"."banned_at" IS NOT NULL THEN $2::user_status WHEN "users"."email_verified_at" IS NULL THEN $3::user_status ELSE $4::user_status END',
    )
    expect(query.params).toEqual([
      UserStatuses.PENDING_DELETION,
      UserStatuses.BANNED,
      UserStatuses.UNVERIFIED,
      UserStatuses.ACTIVE,
    ])
  })

  it('verifies an email: deletion and ban still rank first, then the pending invitation', () => {
    const query = dialect.sqlToQuery(buildStatusOnAction({ verifiesEmail: true }))

    expect(query.sql).toBe(
      'CASE WHEN "users"."deleted_at" IS NOT NULL THEN $1::user_status WHEN "users"."banned_at" IS NOT NULL THEN $2::user_status WHEN "users"."activated_at" IS NULL THEN $3::user_status ELSE $4::user_status END',
    )
    expect(query.params).toEqual([
      UserStatuses.PENDING_DELETION,
      UserStatuses.BANNED,
      UserStatuses.INVITED,
      UserStatuses.ACTIVE,
    ])
  })

  it('agrees with computeUserStatus on every account once the action and the activity are applied', () => {
    const combinations = buildAllFieldCombinations()
    const expectedOnActivation = (fields: UserStatusFields): UserStatus =>
      computeUserStatus({ ...fields, activatedAt: fields.activatedAt ?? NOW, lastActiveAt: NOW }, NOW)
    const expectedOnVerification = (fields: UserStatusFields): UserStatus =>
      computeUserStatus({ ...fields, emailVerifiedAt: NOW, lastActiveAt: NOW }, NOW)

    expect(new Set(combinations.map(expectedOnActivation))).not.toContain(UserStatuses.INACTIVE)
    expect(new Set(combinations.map(expectedOnActivation))).not.toContain(UserStatuses.INVITED)
    expect(new Set(combinations.map(expectedOnVerification))).not.toContain(UserStatuses.INACTIVE)
    expect(new Set(combinations.map(expectedOnVerification))).not.toContain(UserStatuses.UNVERIFIED)
  })
})

describe('buildStatusAfterActivity', () => {
  it('only moves inactive to active, leaving every other status untouched', () => {
    const query = new PgDialect().sqlToQuery(buildStatusAfterActivity())

    expect(query.sql).toBe(
      'CASE WHEN "users"."user_status" = $1 THEN $2::user_status ELSE "users"."user_status" END',
    )
    expect(query.params).toEqual([UserStatuses.INACTIVE, UserStatuses.ACTIVE])
  })

  it('agrees with computeUserStatus on every account once lastActiveAt is bumped', () => {
    const mismatches = buildAllFieldCombinations().filter((fields) => {
      const before = computeUserStatus(fields, NOW)
      const expectedByCase = before === UserStatuses.INACTIVE ? UserStatuses.ACTIVE : before
      return computeUserStatus({ ...fields, lastActiveAt: NOW }, NOW) !== expectedByCase
    })

    expect(mismatches).toEqual([])
  })
})
