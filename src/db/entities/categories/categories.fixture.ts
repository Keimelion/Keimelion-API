import type { db as Db } from '../../client.js'
import { categories, categoryTranslations } from './categories.schema.js'

const ROOT_CATEGORY_FIXTURES = [
  { slug: 'electronics', fr: 'Électronique', en: 'Electronics' },
  { slug: 'fashion-accessories', fr: 'Mode & Accessoires', en: 'Fashion & Accessories' },
  { slug: 'home-decor', fr: 'Maison & Décoration', en: 'Home & Decor' },
  { slug: 'books-media', fr: 'Livres & Médias', en: 'Books & Media' },
  { slug: 'sports-leisure', fr: 'Sports & Loisirs', en: 'Sports & Leisure' },
  { slug: 'beauty-health', fr: 'Beauté & Santé', en: 'Beauty & Health' },
  { slug: 'toys-games', fr: 'Jouets & Jeux', en: 'Toys & Games' },
  { slug: 'food-beverages', fr: 'Alimentation & Boissons', en: 'Food & Beverages' },
  { slug: 'travel', fr: 'Voyage', en: 'Travel' },
  { slug: 'other', fr: 'Autre', en: 'Other' },
] as const

export async function seedCategories(db: typeof Db): Promise<void> {
  const rows = ROOT_CATEGORY_FIXTURES.map((fixture) => ({
    slug: fixture.slug,
    parentId: null,
    depth: 0,
  }))

  const inserted = await db
    .insert(categories)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: categories.id, slug: categories.slug })

  const existing = await db.query.categories.findMany({
    columns: { id: true, slug: true },
  })

  const slugToId = new Map(existing.map((row) => [row.slug, row.id]))

  const translationValues = ROOT_CATEGORY_FIXTURES.flatMap((fixture) => {
    const id = slugToId.get(fixture.slug)
    if (!id) return []
    return [
      { categoryId: id, locale: 'fr' as const, name: fixture.fr },
      { categoryId: id, locale: 'en' as const, name: fixture.en },
    ]
  })

  if (translationValues.length > 0) {
    await db.insert(categoryTranslations).values(translationValues).onConflictDoNothing()
  }

  console.log(`  categories   ${String(inserted.length)} rows`)
}
