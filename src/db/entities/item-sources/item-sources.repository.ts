import { and, eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { itemSources } from './item-sources.schema.js'
import type { ItemSource } from './item-sources.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface InsertItemSourceInput {
  itemId: string
  shopId?: string | null | undefined
  sourceUrl: string | null
  price: string | null
  currency: string
  isPrimary: boolean
}

type UpdateItemSourceFields = Partial<Pick<typeof itemSources.$inferInsert, 'shopId' | 'sourceUrl' | 'price' | 'currency' | 'isPrimary'>>

export async function insertItemSource(input: InsertItemSourceInput, tx?: DbTransaction): Promise<ItemSource | undefined> {
  const client = tx ?? db
  const [source] = await client.insert(itemSources).values(input).returning()
  return source
}

export function findItemSourceById(id: string): Promise<ItemSource | undefined> {
  return db.query.itemSources.findFirst({ where: eq(itemSources.id, id) })
}

export function findItemSourcesByItemId(itemId: string): Promise<ItemSource[]> {
  return db.query.itemSources.findMany({ where: eq(itemSources.itemId, itemId) })
}

export async function updateItemSource(
  id: string,
  fields: UpdateItemSourceFields,
  tx?: DbTransaction,
): Promise<ItemSource | undefined> {
  const client = tx ?? db
  const [row] = await client.update(itemSources).set(fields).where(eq(itemSources.id, id)).returning()
  return row
}

export async function deleteItemSource(id: string, tx?: DbTransaction): Promise<ItemSource | undefined> {
  const client = tx ?? db
  const [row] = await client.delete(itemSources).where(eq(itemSources.id, id)).returning()
  return row
}

export async function demotePrimaryItemSource(itemId: string, tx: DbTransaction): Promise<void> {
  await tx
    .update(itemSources)
    .set({ isPrimary: false })
    .where(and(eq(itemSources.itemId, itemId), eq(itemSources.isPrimary, true)))
}

export async function setPrimaryItemSource(
  itemId: string,
  sourceId: string,
  tx: DbTransaction,
): Promise<void> {
  await demotePrimaryItemSource(itemId, tx)

  await tx
    .update(itemSources)
    .set({ isPrimary: true })
    .where(and(eq(itemSources.id, sourceId), eq(itemSources.itemId, itemId)))
}
