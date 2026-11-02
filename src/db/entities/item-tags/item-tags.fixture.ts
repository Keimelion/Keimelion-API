import { inArray } from 'drizzle-orm'
import type { db as Db } from '../../client.js'
import { ITEM_IDS } from '../items/items.fixture.js'
import { tags } from '../tags/tags.schema.js'
import { itemTags } from './item-tags.schema.js'

interface ItemTagFixture {
  itemId: string
  tagSlug: string
}

const ITEM_TAG_FIXTURES: readonly ItemTagFixture[] = [
  { itemId: ITEM_IDS.BIRTHDAY_HEADPHONES, tagSlug: 'tech' },
  { itemId: ITEM_IDS.BIRTHDAY_HEADPHONES, tagSlug: 'urgent' },
  { itemId: ITEM_IDS.WEDDING_VASE, tagSlug: 'handmade' },
  { itemId: ITEM_IDS.WEDDING_VASE, tagSlug: 'eco' },
  { itemId: ITEM_IDS.WEDDING_WINE, tagSlug: 'vintage' },
]

export async function seedItemTags(db: typeof Db): Promise<void> {
  const slugs = Array.from(new Set(ITEM_TAG_FIXTURES.map((fixture) => fixture.tagSlug)))
  const tagRows = await db.query.tags.findMany({
    where: inArray(tags.slug, slugs),
    columns: { id: true, slug: true },
  })
  const tagIdBySlug = new Map(tagRows.map((row) => [row.slug, row.id]))

  const values = ITEM_TAG_FIXTURES.flatMap((fixture) => {
    const tagId = tagIdBySlug.get(fixture.tagSlug)
    if (!tagId) return []
    return [{ itemId: fixture.itemId, tagId }]
  })

  if (values.length === 0) {
    console.log(`  item_tags        0 rows`)
    return
  }

  const inserted = await db
    .insert(itemTags)
    .values(values)
    .onConflictDoNothing()
    .returning({ itemId: itemTags.itemId })

  console.log(`  item_tags        ${String(inserted.length)} rows`)
}
