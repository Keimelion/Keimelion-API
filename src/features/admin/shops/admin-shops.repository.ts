import { and, asc, count, eq, or, type SQL } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { shops } from '../../../db/entities/shops/shops.schema.js'
import { buildOrderBy, type SortConfig } from '../../../shared/db/sort.js'
import { nullnessFlag, stringContains } from '../../../shared/db/filters.js'
import type { Shop } from '../../../db/entities/shops/shops.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'

export type AdminShopsSortField = 'name' | 'slug' | 'sortOrder' | 'createdAt' | 'updatedAt'

export interface ListShopsFilters {
  search?: string | undefined
  isActive?: boolean | undefined
  isAffiliated?: boolean | undefined
  hasDomain?: boolean | undefined
  sort?: SortInput<AdminShopsSortField> | undefined
}

const SHOPS_SORT: SortConfig<AdminShopsSortField> = {
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

function buildShopsWhere(filters: ListShopsFilters): SQL | undefined {
  return and(
    filters.isActive !== undefined ? eq(shops.isActive, filters.isActive) : undefined,
    filters.isAffiliated !== undefined ? eq(shops.isAffiliated, filters.isAffiliated) : undefined,
    nullnessFlag(shops.domain, filters.hasDomain),
    filters.search !== undefined
      ? or(stringContains(shops.name, filters.search), stringContains(shops.slug, filters.search))
      : undefined,
  )
}

function buildShopsOrderBy(sort: SortInput<AdminShopsSortField> | undefined): SQL[] {
  if (sort !== undefined) {
    return [buildOrderBy(SHOPS_SORT, sort)]
  }
  return [asc(shops.sortOrder), asc(shops.name)]
}

export function findAllShops(input: PaginationInput, filters: ListShopsFilters): Promise<Shop[]> {
  const offset = (input.page - 1) * input.limit
  return db.query.shops.findMany({
    where: buildShopsWhere(filters),
    orderBy: buildShopsOrderBy(filters.sort),
    limit: input.limit,
    offset,
  })
}

export async function countShops(filters: ListShopsFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(shops)
    .where(buildShopsWhere(filters))
  return row?.count ?? 0
}
