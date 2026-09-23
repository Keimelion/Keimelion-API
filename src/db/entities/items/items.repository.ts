import { and, count, eq, isNull } from 'drizzle-orm'
import { db } from '../../client.js'
import { items } from './items.schema.js'
import { listItems } from '../list-items/list-items.schema.js'
import type { ModerationStatus } from '../../../shared/enums/moderation-status.js'
import type { Item } from './items.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface InsertItemInput {
  name: string
  description: string | null
  imageUrl: string | null
  createdByUserId: string | null
  moderationStatus: ModerationStatus
}

interface FindItemByIdOptions {
  includeDeleted?: boolean
}

type UpdateItemFields = Partial<Pick<typeof items.$inferInsert, 'name' | 'description' | 'imageUrl' | 'moderationStatus'>>

export async function insertItem(input: InsertItemInput, tx?: DbTransaction): Promise<Item | undefined> {
  const client = tx ?? db
  const [item] = await client.insert(items).values(input).returning()
  return item
}

export function findItemById(id: string, options?: FindItemByIdOptions): Promise<Item | undefined> {
  const includeDeleted = options?.includeDeleted ?? false
  const where = includeDeleted
    ? eq(items.id, id)
    : and(eq(items.id, id), isNull(items.deletedAt))
  return db.query.items.findFirst({ where })
}

export async function updateItem(
  id: string,
  fields: UpdateItemFields,
  tx?: DbTransaction,
): Promise<Item | undefined> {
  const client = tx ?? db
  const [row] = await client.update(items).set(fields).where(eq(items.id, id)).returning()
  return row
}

export async function softDeleteItem(id: string, tx?: DbTransaction): Promise<Item | undefined> {
  const client = tx ?? db
  const [row] = await client
    .update(items)
    .set({ deletedAt: new Date() })
    .where(eq(items.id, id))
    .returning()
  return row
}

export async function restoreItem(id: string, tx?: DbTransaction): Promise<Item | undefined> {
  const client = tx ?? db
  const [row] = await client
    .update(items)
    .set({ deletedAt: null })
    .where(eq(items.id, id))
    .returning()
  return row
}

export async function countListItemsReferencing(itemId: string, tx?: DbTransaction): Promise<number> {
  const client = tx ?? db
  const [row] = await client
    .select({ total: count() })
    .from(listItems)
    .where(eq(listItems.itemId, itemId))
  return row?.total ?? 0
}
