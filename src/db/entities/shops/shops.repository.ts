import { eq, inArray } from 'drizzle-orm'
import { db } from '../../client.js'
import { shops } from './shops.schema.js'
import type { Shop } from './shops.schema.js'

interface ShopWriteFields {
  slug: string
  name: string
  domain: string | null
  logoUrl: string | null
  isAffiliated: boolean
  sortOrder: number
  isActive: boolean
}

type InsertShopFields = ShopWriteFields
type UpdateShopFields = Partial<ShopWriteFields>

export async function findShopById(id: string): Promise<Shop | undefined> {
  return db.query.shops.findFirst({ where: eq(shops.id, id) })
}

export async function findShopsByIds(ids: string[]): Promise<Map<string, Shop>> {
  if (ids.length === 0) return new Map()

  const rows = await db.query.shops.findMany({ where: inArray(shops.id, ids) })
  const grouped = new Map<string, Shop>()
  for (const row of rows) grouped.set(row.id, row)
  return grouped
}

export async function insertShop(fields: InsertShopFields): Promise<Shop | undefined> {
  const [row] = await db.insert(shops).values(fields).returning()
  return row
}

export async function updateShop(id: string, fields: UpdateShopFields): Promise<Shop | undefined> {
  const [row] = await db.update(shops).set(fields).where(eq(shops.id, id)).returning()
  return row
}

export async function deleteShop(id: string): Promise<Shop | undefined> {
  const [row] = await db.delete(shops).where(eq(shops.id, id)).returning()
  return row
}
