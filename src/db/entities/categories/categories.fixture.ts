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

const CHILD_CATEGORY_FIXTURES = [
  {
    slug: 'audio',
    parentSlug: 'electronics',
    fr: 'Audio',
    en: 'Audio',
  },
  {
    slug: 'small-appliances',
    parentSlug: 'home-decor',
    fr: 'Petit électroménager',
    en: 'Small appliances',
  },
  {
    slug: 'board-games',
    parentSlug: 'toys-games',
    fr: 'Jeux de société',
    en: 'Board games',
  },
] as const

export async function seedCategories(db: typeof Db): Promise<void> {
  const rootRows = ROOT_CATEGORY_FIXTURES.map((fixture) => ({
    slug: fixture.slug,
    parentId: null,
    depth: 0,
  }))

  const insertedRoots = await db
    .insert(categories)
    .values(rootRows)
    .onConflictDoNothing()
    .returning({ id: categories.id, slug: categories.slug })

  const rootsNow = await db.query.categories.findMany({
    columns: { id: true, slug: true },
  })
  const slugToId = new Map(rootsNow.map((row) => [row.slug, row.id]))

  const childRows = CHILD_CATEGORY_FIXTURES.flatMap((fixture) => {
    const parentId = slugToId.get(fixture.parentSlug)
    if (!parentId) return []
    return [{ slug: fixture.slug, parentId, depth: 1 }]
  })

  const insertedChildren =
    childRows.length > 0
      ? await db
          .insert(categories)
          .values(childRows)
          .onConflictDoNothing()
          .returning({ id: categories.id, slug: categories.slug })
      : []

  if (insertedChildren.length > 0) {
    for (const child of insertedChildren) slugToId.set(child.slug, child.id)
  }

  const allFixtures = [
    ...ROOT_CATEGORY_FIXTURES.map((fixture) => ({ slug: fixture.slug, fr: fixture.fr, en: fixture.en })),
    ...CHILD_CATEGORY_FIXTURES.map((fixture) => ({ slug: fixture.slug, fr: fixture.fr, en: fixture.en })),
  ]

  const translationValues = allFixtures.flatMap((fixture) => {
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

  const totalInserted = insertedRoots.length + insertedChildren.length
  console.log(`  categories   ${String(totalInserted)} rows`)
}
