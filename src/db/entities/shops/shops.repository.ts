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

export function findShopsByDomains(domains: string[]): Promise<Shop[]> {
  return db.query.shops.findMany({ where: inArray(shops.domain, domains) })
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
