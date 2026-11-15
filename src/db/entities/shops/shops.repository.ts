import { and, eq, inArray, or } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../../client.js'
import type { DbTransaction } from '../../client.js'
import { shops } from './shops.schema.js'
import type { Shop } from './shops.schema.js'
import type { ShopWrite } from '../../../shared/types/shop.js'

export async function findShopById(id: string): Promise<Shop | undefined> {
  return db.query.shops.findFirst({ where: eq(shops.id, id) })
}

export function findShopsByIdsOrDomains(ids: string[], domains: string[]): Promise<Shop[]> {
  const conditions = [
    ids.length > 0 ? inArray(shops.id, ids) : undefined,
    domains.length > 0 ? inArray(shops.domain, domains) : undefined,
  ].filter((condition): condition is SQL => condition !== undefined)
  if (conditions.length === 0) return Promise.resolve([])
  return db.query.shops.findMany({ where: or(...conditions) })
}

export async function lockShop(id: string, tx: DbTransaction): Promise<Shop | undefined> {
  const [row] = await tx.select().from(shops).where(eq(shops.id, id)).for('update')
  return row
}

export async function lockShopIfAffiliated(id: string, tx: DbTransaction): Promise<boolean> {
  const [row] = await tx
    .select({ id: shops.id })
    .from(shops)
    .where(and(eq(shops.id, id), eq(shops.isAffiliated, true)))
    .for('share')
  return row !== undefined
}

export async function insertShop(fields: ShopWrite): Promise<Shop | undefined> {
  const [row] = await db.insert(shops).values(fields).returning()
  return row
}

export async function updateShop(id: string, fields: Partial<ShopWrite>, tx: DbTransaction): Promise<Shop | undefined> {
  const [row] = await tx.update(shops).set(fields).where(eq(shops.id, id)).returning()
  return row
}

export async function deleteShop(id: string, tx: DbTransaction): Promise<Shop | undefined> {
  const [row] = await tx.delete(shops).where(eq(shops.id, id)).returning()
  return row
}
