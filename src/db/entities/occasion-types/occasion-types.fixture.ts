import type { db as Db } from '../../client.js'
import { occasionTypes, occasionTypeTranslations } from './occasion-types.schema.js'

const OCCASION_TYPE_FIXTURES = [
  { slug: 'mariage', emoji: '💍', sortOrder: 10 },
  { slug: 'naissance', emoji: '👶', sortOrder: 20 },
  { slug: 'anniversaire', emoji: '🎂', sortOrder: 30 },
  { slug: 'premier-appartement', emoji: '🏠', sortOrder: 40 },
  { slug: 'autre', emoji: '🎁', sortOrder: 50 },
] as const

const TRANSLATION_FIXTURES = [
  { slug: 'mariage', fr: 'Mariage', en: 'Wedding' },
  { slug: 'naissance', fr: 'Naissance', en: 'Birth' },
  { slug: 'anniversaire', fr: 'Anniversaire', en: 'Birthday' },
  { slug: 'premier-appartement', fr: 'Premier appartement', en: 'First apartment' },
  { slug: 'autre', fr: 'Autre', en: 'Other' },
] as const

export async function seedOccasionTypes(db: typeof Db): Promise<void> {
  const inserted = await db
    .insert(occasionTypes)
    .values(OCCASION_TYPE_FIXTURES.map((fixture) => ({ ...fixture })))
    .onConflictDoNothing()
    .returning({ id: occasionTypes.id, slug: occasionTypes.slug })

  const rows = await db.query.occasionTypes.findMany({
    columns: { id: true, slug: true },
  })

  const slugToId = new Map(rows.map((row) => [row.slug, row.id]))

  const translationValues = TRANSLATION_FIXTURES.flatMap((fixture) => {
    const id = slugToId.get(fixture.slug)
    if (!id) return []
    return [
      { occasionTypeId: id, locale: 'fr' as const, label: fixture.fr },
      { occasionTypeId: id, locale: 'en' as const, label: fixture.en },
    ]
  })

  if (translationValues.length > 0) {
    await db.insert(occasionTypeTranslations).values(translationValues).onConflictDoNothing()
  }

  console.log(`  occasion_types ${String(inserted.length)} rows`)
}
