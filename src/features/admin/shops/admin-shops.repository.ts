import { asc, count, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/client.js'
import { shops } from '../../../db/entities/shops/shops.schema.js'
import { buildOrderBy, type SortConfig } from '../../../shared/db/sort.js'
import { buildGenericWhere } from '../../../shared/db/filter-where.js'
import type { FilterConfig } from '../../../shared/db/filter-config.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'
import type { Shop } from '../../../db/entities/shops/shops.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'

export type AdminShopsSortField = 'name' | 'slug' | 'sortOrder' | 'createdAt' | 'updatedAt'

interface AdminShopsFilterEntity {
  name: string
  slug: string
  domain: string | null
  isActive: boolean
  isAffiliated: boolean
}

const booleanStringSchema = z.enum(['true', 'false'])

export const shopsGenericFilterConfig: FilterConfig<AdminShopsFilterEntity> = {
  name:         { column: shops.name,         operators: ['eq', 'ilike'] },
  slug:         { column: shops.slug,         operators: ['eq', 'ilike'] },
  domain:       { column: shops.domain,       operators: ['eq', 'ilike', 'isNull'] },
  isActive:     { column: shops.isActive,     operators: ['eq'], valueType: 'boolean', valueSchema: booleanStringSchema },
  isAffiliated: { column: shops.isAffiliated, operators: ['eq'], valueType: 'boolean', valueSchema: booleanStringSchema },
}

export interface ListShopsFilters {
  sort?: SortInput<AdminShopsSortField> | undefined
  genericFilters?: FilterInput[] | undefined
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
  const generic = filters.genericFilters ?? []
  if (generic.length === 0) return undefined
  return buildGenericWhere(shopsGenericFilterConfig, generic)
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
