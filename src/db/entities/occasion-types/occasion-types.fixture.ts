import type { db as Db } from '../../client.js'
import { occasionTypes } from './occasion-types.schema.js'

const OCCASION_TYPE_FIXTURES = [
  { slug: 'mariage', label: 'Mariage', emoji: '💍', sortOrder: 10 },
  { slug: 'naissance', label: 'Naissance', emoji: '👶', sortOrder: 20 },
  { slug: 'anniversaire', label: 'Anniversaire', emoji: '🎂', sortOrder: 30 },
  { slug: 'premier-appartement', label: 'Premier appartement', emoji: '🏠', sortOrder: 40 },
  { slug: 'autre', label: 'Autre', emoji: '🎁', sortOrder: 50 },
] as const

export async function seedOccasionTypes(db: typeof Db): Promise<void> {
  const inserted = await db
    .insert(occasionTypes)
    .values(OCCASION_TYPE_FIXTURES.map((fixture) => ({ ...fixture })))
    .onConflictDoNothing()
    .returning({ id: occasionTypes.id, slug: occasionTypes.slug })
  console.log(`  occasion_types ${String(inserted.length)} rows`)
}
