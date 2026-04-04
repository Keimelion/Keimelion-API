import type { db as Db } from '../client.js'
import { users } from '../schema/index.js'
import { hashPassword } from '../../utils/hash.js'

const FIXTURE_PASSWORD = 'password'

export async function seedUsers(db: typeof Db): Promise<void> {
  const passwordHashed = await hashPassword(FIXTURE_PASSWORD)

  const fixtures = [
    {
      email: 'alice.martin@gmail.com',
      username: 'alice',
      passwordHash: null,
      authProvider: 'google' as const,
      platformRole: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-03-15T10:00:00Z'),
      isMarketingOptedIn: true,
      lastActiveAt: new Date('2026-04-03T18:42:00Z'),
    },
    {
      email: 'thomas.bernard@outlook.com',
      username: 'thomasbernard',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      platformRole: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-06-01T09:15:00Z'),
      isMarketingOptedIn: false,
      lastActiveAt: new Date('2026-04-01T14:20:00Z'),
    },
    {
      email: 'sophie.lefevre@gmail.com',
      username: 'sophielf',
      passwordHash: null,
      authProvider: 'google' as const,
      platformRole: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-09-20T16:30:00Z'),
      isMarketingOptedIn: true,
      lastActiveAt: new Date('2026-04-04T08:05:00Z'),
    },
    {
      email: 'admin@keimelion.com',
      username: 'admin',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      platformRole: 'admin' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2024-11-01T00:00:00Z'),
      isMarketingOptedIn: false,
      lastActiveAt: new Date('2026-04-04T09:00:00Z'),
    },
    {
      email: 'julien.moreau@yahoo.fr',
      username: 'jmoreau',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      platformRole: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-12-10T11:00:00Z'),
      isMarketingOptedIn: false,
      lastActiveAt: null,
      deletedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      email: 'marc.dupont@hotmail.com',
      username: 'marcdupont',
      passwordHash: passwordHashed,
      authProvider: 'email' as const,
      platformRole: 'user' as const,
      isCgvAccepted: true,
      cgvAcceptedAt: new Date('2025-07-04T14:00:00Z'),
      isMarketingOptedIn: false,
      lastActiveAt: new Date('2026-03-28T10:00:00Z'),
      bannedAt: new Date('2026-03-29T09:00:00Z'),
      banReason: 'Abusive behaviour reported by multiple users.',
    },
  ]

  await db.delete(users)
  const inserted = await db.insert(users).values(fixtures).returning({ id: users.id, email: users.email })
  console.log(`  users        ${String(inserted.length)} rows`)
}
