import { eq, inArray } from 'drizzle-orm'
import { db } from '../../client.js'
import { tags } from './tags.schema.js'
import type { Tag } from './tags.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbClient = typeof db | DbTransaction

interface TagWriteFields {
  name: string
  slug: string
  createdByUserId: string | null
}

type UpdateTagFields = Partial<Pick<typeof tags.$inferInsert, 'name' | 'slug'>>

export async function findTagById(id: string, client: DbClient = db): Promise<Tag | undefined> {
  return client.query.tags.findFirst({ where: eq(tags.id, id) })
}

export async function findTagsBySlugs(slugs: string[], client: DbClient = db): Promise<Tag[]> {
  if (slugs.length === 0) return []
  return client.query.tags.findMany({ where: inArray(tags.slug, slugs) })
}

export async function findTagsByCreator(userId: string): Promise<Tag[]> {
  return db.query.tags.findMany({ where: eq(tags.createdByUserId, userId) })
}

export async function insertTag(
  fields: TagWriteFields,
  client: DbClient = db,
): Promise<Tag | undefined> {
  const [row] = await client.insert(tags).values(fields).returning()
  return row
}

export async function insertTagsIgnoreConflict(
  rows: TagWriteFields[],
  client: DbClient = db,
): Promise<void> {
  if (rows.length === 0) return
  await client.insert(tags).values(rows).onConflictDoNothing({ target: tags.slug })
}

export async function updateTagRow(
  id: string,
  fields: UpdateTagFields,
  client: DbClient = db,
): Promise<Tag | undefined> {
  const [row] = await client.update(tags).set(fields).where(eq(tags.id, id)).returning()
  return row
}

export async function deleteTag(id: string): Promise<Tag | undefined> {
  const [row] = await db.delete(tags).where(eq(tags.id, id)).returning()
  return row
}
