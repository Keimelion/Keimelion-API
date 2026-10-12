import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { listTags } from './list-tags.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbClient = typeof db | DbTransaction

export async function replaceListTags(
  listId: string,
  tagIds: string[],
  client: DbClient = db,
): Promise<void> {
  const run = async (tx: DbClient): Promise<void> => {
    await tx.delete(listTags).where(eq(listTags.listId, listId))
    if (tagIds.length === 0) return
    await tx.insert(listTags).values(tagIds.map((tagId) => ({ listId, tagId })))
  }
  if (client === db) {
    await db.transaction(run)
    return
  }
  await run(client)
}
