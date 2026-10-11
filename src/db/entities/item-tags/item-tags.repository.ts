import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { itemTags } from './item-tags.schema.js'
import type { ItemTag } from './item-tags.schema.js'
import type { Tag } from '../tags/tags.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbClient = typeof db | DbTransaction

export interface ItemTagWithTag extends ItemTag {
  tag: Tag
}

export async function deleteItemTagsForItem(
  itemId: string,
  client: DbClient = db,
): Promise<void> {
  await client.delete(itemTags).where(eq(itemTags.itemId, itemId))
}

export async function insertItemTags(
  itemId: string,
  tagIds: string[],
  client: DbClient = db,
): Promise<void> {
  if (tagIds.length === 0) return
  await client.insert(itemTags).values(
    tagIds.map((tagId) => ({ itemId, tagId })),
  )
}

export async function replaceItemTags(
  itemId: string,
  tagIds: string[],
): Promise<ItemTagWithTag[]> {
  return db.transaction(async (tx) => {
    await deleteItemTagsForItem(itemId, tx)
    await insertItemTags(itemId, tagIds, tx)
    return tx.query.itemTags.findMany({
      where: eq(itemTags.itemId, itemId),
      with: { tag: true },
    })
  })
}
