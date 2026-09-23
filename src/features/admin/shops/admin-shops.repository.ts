import { count, type SQL } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { shops } from '../../../db/entities/shops/shops.schema.js'
import { defineEntity } from '../../../shared/db/entity-descriptor.js'
import type { Shop } from '../../../db/entities/shops/shops.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'

export const shopsEntity = defineEntity({
  sortable: {
    name:      shops.name,
    slug:      shops.slug,
    sortOrder: shops.sortOrder,
    createdAt: shops.createdAt,
    updatedAt: shops.updatedAt,
  },
  defaultSort: [
    { field: 'sortOrder', direction: 'asc' },
    { field: 'name',      direction: 'asc' },
  ],
  filterable: {
    name:         { column: shops.name,         operators: ['eq', 'ilike'] },
    slug:         { column: shops.slug,         operators: ['eq', 'ilike'] },
    domain:       { column: shops.domain,       operators: ['eq', 'ilike', 'isNull'] },
    isActive:     { column: shops.isActive,     operators: ['eq'], valueType: 'boolean' },
    isAffiliated: { column: shops.isAffiliated, operators: ['eq'], valueType: 'boolean' },
  },
})

export type ShopsSortField = keyof typeof shopsEntity.sortable

export interface ListShopsFilters {
  sort?: SortInput<ShopsSortField> | undefined
  genericFilters?: FilterInput[] | undefined
}

function buildShopsWhere(filters: ListShopsFilters): SQL | undefined {
  const generic = filters.genericFilters ?? []
  if (generic.length === 0) return undefined
  return shopsEntity.buildWhere(generic)
}

export function findAllShops(input: PaginationInput, filters: ListShopsFilters): Promise<Shop[]> {
  const offset = (input.page - 1) * input.limit
  return db.query.shops.findMany({
    where: buildShopsWhere(filters),
    orderBy: shopsEntity.buildOrderBy(filters.sort),
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
