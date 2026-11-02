import { inArray } from 'drizzle-orm'
import type { db as Db } from '../../client.js'
import { categories } from '../categories/categories.schema.js'
import { ITEM_IDS } from '../items/items.fixture.js'
import { itemCategories } from './item-categories.schema.js'

interface ItemCategoryFixture {
  itemId: string
  categorySlug: string
}

const ITEM_CATEGORY_FIXTURES: readonly ItemCategoryFixture[] = [
  { itemId: ITEM_IDS.BIRTHDAY_HEADPHONES, categorySlug: 'electronics' },
  { itemId: ITEM_IDS.HOUSEWARMING_COFFEE, categorySlug: 'electronics' },
  // Robot pâtissier sits in two categories — covers the many-to-many path.
  { itemId: ITEM_IDS.WEDDING_STAND_MIXER, categorySlug: 'home-decor' },
  { itemId: ITEM_IDS.WEDDING_STAND_MIXER, categorySlug: 'food-beverages' },
  { itemId: ITEM_IDS.WEDDING_WINE, categorySlug: 'food-beverages' },
]

export async function seedItemCategories(db: typeof Db): Promise<void> {
  const slugs = Array.from(new Set(ITEM_CATEGORY_FIXTURES.map((fixture) => fixture.categorySlug)))
  const categoryRows = await db.query.categories.findMany({
    where: inArray(categories.slug, slugs),
    columns: { id: true, slug: true },
  })
  const categoryIdBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]))

  const values = ITEM_CATEGORY_FIXTURES.flatMap((fixture) => {
    const categoryId = categoryIdBySlug.get(fixture.categorySlug)
    if (!categoryId) return []
    return [{ itemId: fixture.itemId, categoryId }]
  })

  if (values.length === 0) {
    console.log(`  item_categories  0 rows`)
    return
  }

  const inserted = await db
    .insert(itemCategories)
    .values(values)
    .onConflictDoNothing()
    .returning({ itemId: itemCategories.itemId })

  console.log(`  item_categories  ${String(inserted.length)} rows`)
}
