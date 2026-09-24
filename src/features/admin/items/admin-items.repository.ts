import { and, count, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/client.js'
import { items } from '../../../db/entities/items/items.schema.js'
import { defineEntity, buildSoftDeleteDefault } from '../../../shared/db/entity-descriptor.js'
import { MODERATION_STATUS_VALUES } from '../../../shared/enums/moderation-status.js'
import type { Item } from '../../../db/entities/items/items.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'

const moderationStatusSchema = z.enum(MODERATION_STATUS_VALUES)

export const itemsEntity = defineEntity({
  sortable: {
    name:             items.name,
    createdAt:        items.createdAt,
    updatedAt:        items.updatedAt,
    moderationStatus: items.moderationStatus,
    deletedAt:        items.deletedAt,
  },
  defaultSort: [{ field: 'createdAt', direction: 'desc' }],
  filterable: {
    name:             { column: items.name,             operators: ['eq', 'ilike'] },
    moderationStatus: { column: items.moderationStatus, operators: ['eq', 'in'], valueSchema: moderationStatusSchema },
    createdByUserId:  { column: items.createdByUserId,  operators: ['eq', 'isNull'] },
    deletedAt:        { column: items.deletedAt,        operators: ['isNull'] },
    createdAt:        { column: items.createdAt,        operators: ['gte', 'lte', 'between'], valueType: 'date' },
  },
})

export type ItemsSortField = keyof typeof itemsEntity.sortable

export interface ListItemsFilters {
  sort?: SortInput<ItemsSortField> | undefined
  genericFilters?: FilterInput[] | undefined
}

function buildItemsWhere(filters: ListItemsFilters): SQL | undefined {
  const generic = filters.genericFilters ?? []
  const genericClause = generic.length > 0 ? itemsEntity.buildWhere(generic) : undefined
  return and(buildSoftDeleteDefault(generic, items.deletedAt), genericClause)
}

export function findAllItems(input: PaginationInput, filters: ListItemsFilters): Promise<Item[]> {
  const offset = (input.page - 1) * input.limit
  return db.query.items.findMany({
    where: buildItemsWhere(filters),
    orderBy: itemsEntity.buildOrderBy(filters.sort),
    limit: input.limit,
    offset,
  })
}

export async function countItems(filters: ListItemsFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(items)
    .where(buildItemsWhere(filters))
  return row?.count ?? 0
}
