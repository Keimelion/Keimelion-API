import { and, asc, count, eq, ilike, isNotNull, isNull, or, type SQL } from 'drizzle-orm'
import { db } from '../../client.js'
import { shops } from './shops.schema.js'
import { buildOrderBy, type SortConfig } from '../../../shared/db/sort.js'
import type { Shop } from './shops.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'

export type ShopsSortField = 'name' | 'slug' | 'sortOrder' | 'createdAt' | 'updatedAt'

export interface ShopsFilters {
  search?: string | undefined
  isActive?: boolean | undefined
  isAffiliated?: boolean | undefined
  hasDomain?: boolean | undefined
  sort?: SortInput<ShopsSortField> | undefined
}

type InsertShopFields = Omit<typeof shops.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>

type UpdateShopFields = Partial<
  Pick<
    typeof shops.$inferInsert,
    'slug' | 'name' | 'domain' | 'logoUrl' | 'isAffiliated' | 'sortOrder' | 'isActive'
  >
>

const SHOPS_SORT: SortConfig<ShopsSortField> = {
  columns: {
    name: shops.name,
    slug: shops.slug,
    sortOrder: shops.sortOrder,
    createdAt: shops.createdAt,
    updatedAt: shops.updatedAt,
  },
  defaultField: 'sortOrder',
  defaultDirection: 'asc',
}

function buildShopsWhere(filters: ShopsFilters): SQL | undefined {
  return and(
    filters.isActive !== undefined ? eq(shops.isActive, filters.isActive) : undefined,
    filters.isAffiliated !== undefined ? eq(shops.isAffiliated, filters.isAffiliated) : undefined,
    filters.hasDomain !== undefined
      ? filters.hasDomain
        ? isNotNull(shops.domain)
        : isNull(shops.domain)
      : undefined,
    filters.search !== undefined
      ? or(
          ilike(shops.name, `%${filters.search}%`),
          ilike(shops.slug, `%${filters.search}%`),
        )
      : undefined,
  )
}

export async function findShopById(id: string): Promise<Shop | undefined> {
  return db.query.shops.findFirst({ where: eq(shops.id, id) })
}

export function findAllShops(input: PaginationInput, filters: ShopsFilters): Promise<Shop[]> {
  const offset = (input.page - 1) * input.limit
  const orderBy = buildShopsOrderBy(filters.sort)
  return db.query.shops.findMany({
    where: buildShopsWhere(filters),
    orderBy,
    limit: input.limit,
    offset,
  })
}

export async function countShops(filters: ShopsFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(shops)
    .where(buildShopsWhere(filters))
  return row?.count ?? 0
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

function buildShopsOrderBy(sort: SortInput<ShopsSortField> | undefined): SQL[] {
  if (sort !== undefined) {
    return [buildOrderBy(SHOPS_SORT, sort)]
  }
  return [asc(shops.sortOrder), asc(shops.name)]
}
