import { inArray } from 'drizzle-orm'
import type { db as Db } from '../../client.js'
import { LIST_IDS } from '../lists/lists.fixture.js'
import { tags } from '../tags/tags.schema.js'
import { listTags } from './list-tags.schema.js'

interface ListTagFixture {
  listId: string
  tagSlug: string
}

const LIST_TAG_FIXTURES: readonly ListTagFixture[] = [
  { listId: LIST_IDS.BIRTHDAY, tagSlug: 'urgent' },
  { listId: LIST_IDS.WEDDING, tagSlug: 'handmade' },
  { listId: LIST_IDS.WEDDING, tagSlug: 'eco' },
]

export async function seedListTags(db: typeof Db): Promise<void> {
  const slugs = Array.from(new Set(LIST_TAG_FIXTURES.map((fixture) => fixture.tagSlug)))
  const tagRows = await db.query.tags.findMany({
    where: inArray(tags.slug, slugs),
    columns: { id: true, slug: true },
  })
  const tagIdBySlug = new Map(tagRows.map((row) => [row.slug, row.id]))

  const values = LIST_TAG_FIXTURES.flatMap((fixture) => {
    const tagId = tagIdBySlug.get(fixture.tagSlug)
    if (!tagId) return []
    return [{ listId: fixture.listId, tagId }]
  })

  if (values.length === 0) {
    console.log(`  list_tags        0 rows`)
    return
  }

  const inserted = await db
    .insert(listTags)
    .values(values)
    .onConflictDoNothing()
    .returning({ listId: listTags.listId })

  console.log(`  list_tags        ${String(inserted.length)} rows`)
}
