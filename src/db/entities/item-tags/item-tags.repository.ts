import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { itemTags } from './item-tags.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbClient = typeof db | DbTransaction

export async function replaceItemTags(
  itemId: string,
  tagIds: string[],
  client: DbClient = db,
): Promise<void> {
  const run = async (tx: DbClient): Promise<void> => {
    await tx.delete(itemTags).where(eq(itemTags.itemId, itemId))
    if (tagIds.length === 0) return
    await tx.insert(itemTags).values(tagIds.map((tagId) => ({ itemId, tagId })))
  }
  if (client === db) {
    await db.transaction(run)
    return
  }
  await run(client)
}
