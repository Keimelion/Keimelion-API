import type { db as Db } from '../../client.js'
import { occasionTypes, occasionTypeTranslations } from './occasion-types.schema.js'

const OCCASION_TYPE_FIXTURES = [
  { slug: 'wedding', emoji: '💍', sortOrder: 10 },
  { slug: 'birth', emoji: '👶', sortOrder: 20 },
  { slug: 'birthday', emoji: '🎂', sortOrder: 30 },
  { slug: 'first-apartment', emoji: '🏠', sortOrder: 40 },
  { slug: 'other', emoji: '🎁', sortOrder: 50 },
] as const

const TRANSLATION_FIXTURES = [
  { slug: 'wedding', fr: 'Mariage', en: 'Wedding' },
  { slug: 'birth', fr: 'Naissance', en: 'Birth' },
  { slug: 'birthday', fr: 'Anniversaire', en: 'Birthday' },
  { slug: 'first-apartment', fr: 'Premier appartement', en: 'First apartment' },
  { slug: 'other', fr: 'Autre', en: 'Other' },
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
