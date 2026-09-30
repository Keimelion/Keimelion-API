import { count, desc, eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { items } from './items.schema.js'
import { listItems } from '../list-items/list-items.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { Item } from './items.schema.js'
import type { ItemRowWithSources } from '../../../shared/types/item.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface InsertItemInput {
  name: string
  description: string | null
  imageUrl: string | null
  createdByUserId: string | null
}

type UpdateItemFields = Partial<Pick<typeof items.$inferInsert, 'name' | 'description' | 'imageUrl'>>

const ITEM_WITH_SOURCES_WITH = {
  sources: { with: { shop: true } },
} as const

export async function insertItem(input: InsertItemInput, tx?: DbTransaction): Promise<Item | undefined> {
  const client = tx ?? db
  const [item] = await client.insert(items).values(input).returning()
  return item
}

export function findItemById(id: string): Promise<Item | undefined> {
  return db.query.items.findFirst({ where: eq(items.id, id) })
}

export function findItemByIdWithSources(id: string): Promise<ItemRowWithSources | undefined> {
  return db.query.items.findFirst({
    where: eq(items.id, id),
    with: ITEM_WITH_SOURCES_WITH,
  })
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

export async function deleteItem(id: string, tx?: DbTransaction): Promise<Item | undefined> {
  const client = tx ?? db
  const [row] = await client.delete(items).where(eq(items.id, id)).returning()
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

export function findAllItemsWithSources(pagination: PaginationInput): Promise<ItemRowWithSources[]> {
  const offset = (pagination.page - 1) * pagination.limit
  return db.query.items.findMany({
    orderBy: [desc(items.createdAt)],
    limit: pagination.limit,
    offset,
    with: ITEM_WITH_SOURCES_WITH,
  })
}

export async function countAllItems(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(items)
  return row?.total ?? 0
}
