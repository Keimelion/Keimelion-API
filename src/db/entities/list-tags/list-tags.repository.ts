import { and, eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { listTags } from './list-tags.schema.js'
import type { ListTag } from './list-tags.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbClient = typeof db | DbTransaction

export async function insertListTagsIgnoreConflict(
  listId: string,
  tagIds: string[],
  client: DbClient = db,
): Promise<void> {
  if (tagIds.length === 0) return
  await client
    .insert(listTags)
    .values(tagIds.map((tagId) => ({ listId, tagId })))
    .onConflictDoNothing({ target: [listTags.listId, listTags.tagId] })
}

export async function deleteListTag(
  listId: string,
  tagId: string,
  client: DbClient = db,
): Promise<ListTag | undefined> {
  const [row] = await client
    .delete(listTags)
    .where(and(eq(listTags.listId, listId), eq(listTags.tagId, tagId)))
    .returning()
  return row
}
