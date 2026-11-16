import type { db as Db } from '../../client.js'
import { hashPassword, hashSha256Hex } from '../../../shared/utils/hash.js'
import { users } from './users.schema.js'
import { computeUserStatus } from './users.status.js'

const FIXTURE_PASSWORD = 'password'

/**
 * Deterministic raw reset tokens for dev — hashed with SHA-256 before storage
 * (matches the hash scheme used by `requestPasswordReset` in `auth.service.ts`).
 * Expose the RAW tokens here so a dev can hit `POST /auth/reset-password` with
 * them during manual QA.
 */
export const DEV_RESET_TOKENS = {
  USER_VALID: 'dev-reset-token-user-valid-01',
  USER_EXPIRED: 'dev-reset-token-user-expired-01',
  STAFF_INVITATION: 'dev-reset-token-staff-invitation-01',
  STAFF_INVITATION_EXPIRED: 'dev-reset-token-staff-invitation-expired-01',
} as const

export async function seedUsers(db: typeof Db): Promise<void> {
  const passwordHashed = await hashPassword(FIXTURE_PASSWORD)

  const fixtures = [
    {
      email: 'user@example.com',
      username: 'user',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-06-01T09:15:00Z'),
      activatedAt: new Date('2025-06-01T09:15:00Z'),
      isMarketingOptedIn: true,
      emailVerifiedAt: new Date('2025-06-01T09:20:00Z'),
      lastActiveAt: new Date('2026-04-01T14:20:00Z'),
      passwordResetToken: hashSha256Hex(DEV_RESET_TOKENS.USER_VALID),
      passwordResetTokenExpiresAt: new Date('2099-12-31T23:59:59Z'),
    },
    {
      email: 'moderator@example.com',
      username: 'moderator',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'moderator' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-03-01T10:00:00Z'),
      activatedAt: new Date('2025-03-01T10:00:00Z'),
      isMarketingOptedIn: false,
      emailVerifiedAt: new Date('2025-03-01T10:05:00Z'),
      lastActiveAt: new Date('2026-04-03T18:42:00Z'),
    },
    {
      email: 'admin@keimelion.com',
      username: 'admin',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'admin' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2024-11-01T00:00:00Z'),
      activatedAt: new Date('2024-11-01T00:00:00Z'),
      isMarketingOptedIn: false,
      emailVerifiedAt: new Date('2024-11-01T00:05:00Z'),
      lastActiveAt: new Date('2026-04-04T09:00:00Z'),
    },
    {
      email: 'google.user@gmail.com',
      username: 'googleuser',
      passwordHash: null,
      authProvider: 'google' as const,
      role: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-09-20T16:30:00Z'),
      activatedAt: new Date('2025-09-20T16:30:00Z'),
      isMarketingOptedIn: true,
      emailVerifiedAt: new Date('2025-09-20T16:30:00Z'),
      lastActiveAt: new Date('2026-04-04T08:05:00Z'),
    },
    {
      email: 'unverified.user@example.com',
      username: 'unverifieduser',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2026-04-10T08:00:00Z'),
      activatedAt: new Date('2026-04-10T08:00:00Z'),
      isMarketingOptedIn: false,
      passwordResetToken: hashSha256Hex(DEV_RESET_TOKENS.USER_EXPIRED),
      passwordResetTokenExpiresAt: new Date('2024-01-01T00:00:00Z'),
    },
    {
      email: 'deleted.user@example.com',
      username: 'deleteduser',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-12-10T11:00:00Z'),
      activatedAt: new Date('2025-12-10T11:00:00Z'),
      isMarketingOptedIn: false,
      emailVerifiedAt: new Date('2025-12-10T11:05:00Z'),
      lastActiveAt: null,
      deletedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      email: 'banned.user@example.com',
      username: 'banneduser',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-07-04T14:00:00Z'),
      activatedAt: new Date('2025-07-04T14:00:00Z'),
      isMarketingOptedIn: false,
      emailVerifiedAt: new Date('2025-07-04T14:05:00Z'),
      lastActiveAt: new Date('2026-03-28T10:00:00Z'),
      bannedAt: new Date('2026-03-29T09:00:00Z'),
      banReason: 'Abusive behaviour reported by multiple users.',
    },
    {
      email: 'invited.moderator@example.com',
      username: 'invitedmoderator',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'moderator' as const,
      isCgvAccepted: false,
      cgvAcceptedAt: null,
      activatedAt: null,
      isMarketingOptedIn: false,
      emailVerifiedAt: new Date('2026-11-01T10:00:00Z'),
      passwordResetToken: hashSha256Hex(DEV_RESET_TOKENS.STAFF_INVITATION),
      passwordResetTokenExpiresAt: new Date('2099-12-31T23:59:59Z'),
    },
    // Invitation link expired before use: the case POST /admin/users/:id/resend-invitation exists for
    {
      email: 'expired.invitation.admin@example.com',
      username: 'expiredinvitationadmin',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'admin' as const,
      isCgvAccepted: false,
      cgvAcceptedAt: null,
      activatedAt: null,
      isMarketingOptedIn: false,
      emailVerifiedAt: new Date('2026-10-01T09:00:00Z'),
      passwordResetToken: hashSha256Hex(DEV_RESET_TOKENS.STAFF_INVITATION_EXPIRED),
      passwordResetTokenExpiresAt: new Date('2026-10-02T09:00:00Z'),
      createdAt: new Date('2026-10-01T09:00:00Z'),
    },
    {
      email: 'inactive.user@example.com',
      username: 'inactiveuser',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2024-09-01T08:00:00Z'),
      activatedAt: new Date('2024-09-01T08:00:00Z'),
      isMarketingOptedIn: false,
      emailVerifiedAt: new Date('2024-09-01T08:05:00Z'),
      lastActiveAt: new Date('2025-02-10T19:00:00Z'),
      createdAt: new Date('2024-09-01T08:00:00Z'),
    },
  ]

  const now = new Date()
  const rows = fixtures.map((fixture) => ({
    ...fixture,
    userStatus: computeUserStatus(
      {
        deletedAt: fixture.deletedAt ?? null,
        bannedAt: fixture.bannedAt ?? null,
        activatedAt: fixture.activatedAt,
        emailVerifiedAt: fixture.emailVerifiedAt ?? null,
        lastActiveAt: fixture.lastActiveAt ?? null,
        createdAt: fixture.createdAt ?? now,
      },
      now,
    ),
  }))

  const inserted = await db
    .insert(users)
    .values(rows)
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email })
  console.log(`  users        ${String(inserted.length)} rows`)
}
