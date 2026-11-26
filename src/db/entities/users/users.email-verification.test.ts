import { describe, it, expect, afterEach } from 'vitest'
import { env } from '../../../config/env.js'
import { ONE_DAY_MS } from '../../../shared/utils/time.js'
import { computeEmailVerificationDeadline, isEmailVerificationOverdue } from './users.email-verification.js'

const CREATED_AT = new Date('2026-11-01T10:00:00Z')
const UNVERIFIED = { emailVerifiedAt: null, createdAt: CREATED_AT }
const VERIFIED = { emailVerifiedAt: new Date('2026-11-02T10:00:00Z'), createdAt: CREATED_AT }
const ORIGINAL_GRACE_DAYS = env.EMAIL_VERIFICATION_GRACE_DAYS

function computeExpectedDeadline(): Date {
  return new Date(CREATED_AT.getTime() + env.EMAIL_VERIFICATION_GRACE_DAYS * ONE_DAY_MS)
}

afterEach(() => {
  env.EMAIL_VERIFICATION_GRACE_DAYS = ORIGINAL_GRACE_DAYS
})

describe('computeEmailVerificationDeadline', () => {
  it('is the account creation plus EMAIL_VERIFICATION_GRACE_DAYS while the email is unverified', () => {
    expect(computeEmailVerificationDeadline(UNVERIFIED)).toEqual(new Date('2026-11-08T10:00:00Z'))
  })

  it('is null once the email is verified', () => {
    expect(computeEmailVerificationDeadline(VERIFIED)).toBeNull()
  })

  it('follows the configured grace period', () => {
    env.EMAIL_VERIFICATION_GRACE_DAYS = 1

    expect(computeEmailVerificationDeadline(UNVERIFIED)).toEqual(new Date('2026-11-02T10:00:00Z'))
  })
})

describe('isEmailVerificationOverdue', () => {
  it('is false before the deadline', () => {
    const justBefore = new Date(computeExpectedDeadline().getTime() - 1)

    expect(isEmailVerificationOverdue(UNVERIFIED, justBefore)).toBe(false)
  })

  it('is true exactly at the deadline and after it', () => {
    const deadline = computeExpectedDeadline()

    expect(isEmailVerificationOverdue(UNVERIFIED, deadline)).toBe(true)
    expect(isEmailVerificationOverdue(UNVERIFIED, new Date(deadline.getTime() + ONE_DAY_MS))).toBe(true)
  })

  it('is never true for a verified account', () => {
    const longAfter = new Date(computeExpectedDeadline().getTime() + 365 * ONE_DAY_MS)

    expect(isEmailVerificationOverdue(VERIFIED, longAfter)).toBe(false)
  })
})
