import type { db as Db } from '../../client.js'
import { hashPassword } from '../../../shared/utils/hash.js'
import { users } from './users.schema.js'

const FIXTURE_PASSWORD = 'password'

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
      isMarketingOptedIn: true,
      emailVerifiedAt: new Date('2025-06-01T09:20:00Z'),
      lastActiveAt: new Date('2026-04-01T14:20:00Z'),
    },
    {
      email: 'moderator@example.com',
      username: 'moderator',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'moderator' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-03-01T10:00:00Z'),
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
      isMarketingOptedIn: false,
    },
    {
      email: 'deleted.user@example.com',
      username: 'deleteduser',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      role: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-12-10T11:00:00Z'),
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
      isMarketingOptedIn: false,
      emailVerifiedAt: new Date('2025-07-04T14:05:00Z'),
      lastActiveAt: new Date('2026-03-28T10:00:00Z'),
      bannedAt: new Date('2026-03-29T09:00:00Z'),
      banReason: 'Abusive behaviour reported by multiple users.',
    },
  ]

  await db.delete(users)
  const inserted = await db.insert(users).values(fixtures).returning({ id: users.id, email: users.email })
  console.log(`  users        ${String(inserted.length)} rows`)
}
