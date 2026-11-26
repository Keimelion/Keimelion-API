import { env } from '../../../config/env.js'
import { ONE_DAY_MS } from '../../../shared/utils/time.js'
import type { User } from './users.schema.js'

export type EmailVerificationFields = Pick<User, 'emailVerifiedAt' | 'createdAt'>

// Never stored: derived from createdAt, so a new EMAIL_VERIFICATION_GRACE_DAYS applies to every
// unverified account, existing ones included.
export function computeEmailVerificationDeadline(user: EmailVerificationFields): Date | null {
  if (user.emailVerifiedAt) return null
  return new Date(user.createdAt.getTime() + env.EMAIL_VERIFICATION_GRACE_DAYS * ONE_DAY_MS)
}

export function isEmailVerificationOverdue(user: EmailVerificationFields, now: Date): boolean {
  const deadline = computeEmailVerificationDeadline(user)
  return deadline !== null && now >= deadline
}
