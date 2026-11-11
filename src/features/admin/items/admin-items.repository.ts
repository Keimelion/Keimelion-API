import { count, type SQL } from 'drizzle-orm'
import type { AnyColumn } from 'drizzle-orm'
import type { ADMIN_ITEMS_SORT_FIELDS } from '@keimelion/sdk/schemas'
import { db } from '../../../db/client.js'
import { items } from '../../../db/entities/items/items.schema.js'
import { defineEntity } from '../../../shared/db/entity-descriptor.js'
import type { ItemRowWithSources } from '../../../shared/types/item.js'
import { getOffset } from '../../../shared/utils/pagination.js'
import type { PaginationQueryParsed, SortInput } from '@keimelion/sdk/schemas'
import type { FilterInput } from '../../../shared/db/filter-parser.js'

export const itemsEntity = defineEntity({
  sortable: {
    name:      items.name,
    createdAt: items.createdAt,
    updatedAt: items.updatedAt,
  } satisfies Record<(typeof ADMIN_ITEMS_SORT_FIELDS)[number], AnyColumn>,
  defaultSort: [{ field: 'createdAt', direction: 'desc' }],
  filterable: {
    id:              { column: items.id,              operators: ['eq', 'in'] },
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
  input: PaginationQueryParsed,
  filters: ListItemsFilters,
): Promise<ItemRowWithSources[]> {
  const offset = getOffset(input)
  return db.query.items.findMany({
    where: buildItemsWhere(filters),
    orderBy: itemsEntity.buildOrderBy(filters.sort),
    limit: input.limit,
    offset,
    with: {
      image: true,
      sources: { with: { shop: true } },
      itemCategories: { with: { category: { with: { translations: true } } } },
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
