import type { DbTransaction } from '../../client.js'
import { and, asc, count, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../../client.js'
import { itemSources, sourceUrlHash } from './item-sources.schema.js'
import { shops } from '../shops/shops.schema.js'
import type { ItemSource } from './item-sources.schema.js'
import type { ItemSourceWithShop, ItemSourceWithShopAndItem } from '../../../shared/types/item.js'

export interface InsertItemSourceInput {
  itemId: string
  shopId: string | null
  sourceUrl: string | null
  originalUrl: string | null
  price: string | null
  currency: string
  createdByUserId: string | null
}

type UpdateItemSourceFields = Partial<
  Pick<typeof itemSources.$inferInsert, 'shopId' | 'sourceUrl' | 'originalUrl' | 'affiliateUrl' | 'price' | 'currency'>
>

export interface PendingAffiliateSource {
  id: string
  shopId: string
  shopSlug: string
  sourceUrl: string
}

interface PendingAffiliateSourcesQuery {
  shopSlugs: readonly string[]
  afterId: string | null
  limit: number
}

export async function insertItemSource(input: InsertItemSourceInput, tx?: DbTransaction): Promise<ItemSource | undefined> {
  const client = tx ?? db
  const [source] = await client.insert(itemSources).values(input).returning()
  return source
}

// Inserts nothing when the URL is held by another source or the item already has a source on the shop.
export async function insertItemSourceIfAbsent(
  input: InsertItemSourceInput,
  tx: DbTransaction,
): Promise<ItemSource | undefined> {
  const [source] = await tx.insert(itemSources).values(input).onConflictDoNothing().returning()
  return source
}

export function findItemSourceBySourceUrl(sourceUrl: string): Promise<ItemSourceWithShopAndItem | undefined> {
  return db.query.itemSources.findFirst({
    where: and(eq(sourceUrlHash(itemSources.sourceUrl), sourceUrlHash(sourceUrl)), eq(itemSources.sourceUrl, sourceUrl)),
    with: { shop: true, item: { with: { image: true } } },
  })
}

export function findItemSourceByItemAndShop(
  itemId: string,
  shopId: string,
  tx: DbTransaction,
): Promise<ItemSourceWithShop | undefined> {
  return tx.query.itemSources.findFirst({
    where: and(eq(itemSources.itemId, itemId), eq(itemSources.shopId, shopId)),
    with: { shop: true },
  })
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

export async function countItemSourcesByItemId(itemId: string, tx?: DbTransaction): Promise<number> {
  const client = tx ?? db
  const [row] = await client
    .select({ total: count() })
    .from(itemSources)
    .where(eq(itemSources.itemId, itemId))
  return row?.total ?? 0
}

export async function findPendingAffiliateSources(query: PendingAffiliateSourcesQuery): Promise<PendingAffiliateSource[]> {
  const rows = await db
    .select({ id: itemSources.id, shopId: shops.id, shopSlug: shops.slug, sourceUrl: itemSources.sourceUrl })
    .from(itemSources)
    .innerJoin(shops, eq(itemSources.shopId, shops.id))
    .where(
      and(
        isNull(itemSources.affiliateUrl),
        isNotNull(itemSources.sourceUrl),
        eq(shops.isAffiliated, true),
        inArray(shops.slug, [...query.shopSlugs]),
        query.afterId === null ? undefined : gt(itemSources.id, query.afterId),
      ),
    )
    .orderBy(asc(itemSources.id))
    .limit(query.limit)
  return rows.flatMap((row) => (row.sourceUrl === null ? [] : [{ ...row, sourceUrl: row.sourceUrl }]))
}

// Writes only if the source still has the URL and shop the link was built from, and no link yet.
export async function storeAffiliateUrl(
  source: PendingAffiliateSource,
  affiliateUrl: string,
  tx: DbTransaction,
): Promise<boolean> {
  const rows = await tx
    .update(itemSources)
    .set({ affiliateUrl })
    .where(
      and(
        eq(itemSources.id, source.id),
        eq(itemSources.shopId, source.shopId),
        eq(itemSources.sourceUrl, source.sourceUrl),
        isNull(itemSources.affiliateUrl),
      ),
    )
    .returning({ id: itemSources.id })
  return rows.length > 0
}

export async function clearAffiliateUrlsByShopId(shopId: string, tx: DbTransaction): Promise<void> {
  await tx
    .update(itemSources)
    .set({ affiliateUrl: null })
    .where(and(eq(itemSources.shopId, shopId), isNotNull(itemSources.affiliateUrl)))
}
