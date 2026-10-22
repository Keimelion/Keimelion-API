import { eq } from 'drizzle-orm'
import type { db as Db } from '../../client.js'
import { users } from '../users/users.schema.js'
import { tags } from './tags.schema.js'

const DEFAULT_TAG_AUTHOR_EMAIL = 'user@example.com'

const TAG_FIXTURES = [
  { slug: 'vintage', name: 'vintage' },
  { slug: 'handmade', name: 'handmade' },
  { slug: 'eco', name: 'eco' },
  { slug: 'tech', name: 'tech' },
  { slug: 'urgent', name: 'urgent' },
] as const

export async function seedTags(db: typeof Db): Promise<void> {
  const author = await db.query.users.findFirst({
    where: eq(users.email, DEFAULT_TAG_AUTHOR_EMAIL),
    columns: { id: true },
  })
  if (!author) {
    throw new Error(`seedTags: seedUsers must run first (missing ${DEFAULT_TAG_AUTHOR_EMAIL})`)
  }

  const inserted = await db
    .insert(tags)
    .values(TAG_FIXTURES.map((fixture) => ({ ...fixture, createdByUserId: author.id })))
    .onConflictDoNothing({ target: tags.slug })
    .returning({ id: tags.id })

  console.log(`  tags             ${String(inserted.length)} rows`)
}
