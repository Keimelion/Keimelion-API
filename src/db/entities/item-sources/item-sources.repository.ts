import { and, count, eq, ne } from 'drizzle-orm'
import { db } from '../../client.js'
import { itemSources } from './item-sources.schema.js'
import type { ItemSource } from './item-sources.schema.js'
import type { ItemSourceWithShop } from '../../../shared/types/item.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface InsertItemSourceInput {
  itemId: string
  shopId?: string | null | undefined
  sourceUrl: string | null
  price: string | null
  currency: string
}

type UpdateItemSourceFields = Partial<Pick<typeof itemSources.$inferInsert, 'shopId' | 'sourceUrl' | 'price' | 'currency'>>

export async function insertItemSource(input: InsertItemSourceInput, tx?: DbTransaction): Promise<ItemSource | undefined> {
  const client = tx ?? db
  const [source] = await client.insert(itemSources).values(input).returning()
  return source
}

export function findItemSourceById(id: string): Promise<ItemSource | undefined> {
  return db.query.itemSources.findFirst({ where: eq(itemSources.id, id) })
}

export function findItemSourceByIdWithShop(id: string): Promise<ItemSourceWithShop | undefined> {
  return db.query.itemSources.findFirst({
    where: eq(itemSources.id, id),
    with: { shop: true },
  })
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

export async function existsItemSourceForShop(
  itemId: string,
  shopId: string,
  excludeSourceId?: string,
): Promise<boolean> {
  const condition = excludeSourceId === undefined
    ? and(eq(itemSources.itemId, itemId), eq(itemSources.shopId, shopId))
    : and(
      eq(itemSources.itemId, itemId),
      eq(itemSources.shopId, shopId),
      ne(itemSources.id, excludeSourceId),
    )
  const row = await db.query.itemSources.findFirst({
    columns: { id: true },
    where: condition,
  })
  return row !== undefined
}

export async function countItemSourcesByItemId(itemId: string, tx?: DbTransaction): Promise<number> {
  const client = tx ?? db
  const [row] = await client
    .select({ total: count() })
    .from(itemSources)
    .where(eq(itemSources.itemId, itemId))
  return row?.total ?? 0
}
