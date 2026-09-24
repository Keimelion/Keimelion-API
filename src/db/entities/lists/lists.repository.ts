import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../client.js'
import { lists } from './lists.schema.js'
import type { List } from './lists.schema.js'

interface FindListByIdOptions {
  includeDeleted?: boolean
}

type UpdateListFields = Partial<
  Pick<typeof lists.$inferInsert, 'title' | 'description' | 'listStatus' | 'occasionTypeId'>
>

export function findListById(id: string, options?: FindListByIdOptions): Promise<List | undefined> {
  const includeDeleted = options?.includeDeleted ?? true
  const where = includeDeleted ? eq(lists.id, id) : and(eq(lists.id, id), isNull(lists.deletedAt))
  return db.query.lists.findFirst({ where })
}

export async function updateList(id: string, fields: UpdateListFields): Promise<List | undefined> {
  const [row] = await db.update(lists).set(fields).where(eq(lists.id, id)).returning()
  return row
}

export async function softDeleteList(id: string): Promise<List | undefined> {
  const [row] = await db
    .update(lists)
    .set({ deletedAt: new Date() })
    .where(eq(lists.id, id))
    .returning()
  return row
}

export async function restoreList(id: string): Promise<List | undefined> {
  const [row] = await db
    .update(lists)
    .set({ deletedAt: null })
    .where(eq(lists.id, id))
    .returning()
  return row
}
