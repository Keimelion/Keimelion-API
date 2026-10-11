import { count, type SQL } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { items } from '../../../db/entities/items/items.schema.js'
import { defineEntity } from '../../../shared/db/entity-descriptor.js'
import type { ItemRowWithSources } from '../../../shared/types/item.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'

export const itemsEntity = defineEntity({
  sortable: {
    name:      items.name,
    createdAt: items.createdAt,
    updatedAt: items.updatedAt,
  },
  defaultSort: [{ field: 'createdAt', direction: 'desc' }],
  filterable: {
    name:            { column: items.name,            operators: ['eq', 'ilike'] },
    createdByUserId: { column: items.createdByUserId, operators: ['eq', 'isNull'] },
    createdAt:       { column: items.createdAt,       operators: ['gte', 'lte', 'between'], valueType: 'date' },
  },
})

export type ItemsSortField = keyof typeof itemsEntity.sortable

export interface ListItemsFilters {
  sort?: SortInput<ItemsSortField> | undefined
  genericFilters?: FilterInput[] | undefined
}

function buildItemsWhere(filters: ListItemsFilters): SQL | undefined {
  const generic = filters.genericFilters ?? []
  return generic.length > 0 ? itemsEntity.buildWhere(generic) : undefined
}

export function findAllItemsWithSources(
  input: PaginationInput,
  filters: ListItemsFilters,
): Promise<ItemRowWithSources[]> {
  const offset = (input.page - 1) * input.limit
  return db.query.items.findMany({
    where: buildItemsWhere(filters),
    orderBy: itemsEntity.buildOrderBy(filters.sort),
    limit: input.limit,
    offset,
    with: {
      sources: { with: { shop: true } },
      itemCategories: { with: { category: true } },
      itemTags: { with: { tag: true } },
    },
  })
}

export async function countItems(filters: ListItemsFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(items)
    .where(buildItemsWhere(filters))
  return row?.count ?? 0
}
