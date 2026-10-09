import { count, type SQL } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { tags } from '../../../db/entities/tags/tags.schema.js'
import { defineEntity } from '../../../shared/db/entity-descriptor.js'
import type { Tag } from '../../../db/entities/tags/tags.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'

export const tagsEntity = defineEntity({
  sortable: {
    name:      tags.name,
    slug:      tags.slug,
    createdAt: tags.createdAt,
    updatedAt: tags.updatedAt,
  },
  defaultSort: [
    { field: 'name', direction: 'asc' },
  ],
  filterable: {
    name:            { column: tags.name,            operators: ['eq', 'ilike'] },
    slug:            { column: tags.slug,            operators: ['eq', 'ilike'] },
    createdByUserId: { column: tags.createdByUserId, operators: ['eq', 'isNull'] },
  },
})

export type TagsSortField = keyof typeof tagsEntity.sortable

export interface ListTagsFilters {
  sort?: SortInput<TagsSortField> | undefined
  genericFilters?: FilterInput[] | undefined
}

function buildTagsWhere(filters: ListTagsFilters): SQL | undefined {
  const generic = filters.genericFilters ?? []
  if (generic.length === 0) return undefined
  return tagsEntity.buildWhere(generic)
}

export function findAllTags(
  input: PaginationInput,
  filters: ListTagsFilters,
): Promise<Tag[]> {
  const offset = (input.page - 1) * input.limit
  return db.query.tags.findMany({
    where: buildTagsWhere(filters),
    orderBy: tagsEntity.buildOrderBy(filters.sort),
    limit: input.limit,
    offset,
  })
}

export async function countTags(filters: ListTagsFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(tags)
    .where(buildTagsWhere(filters))
  return row?.count ?? 0
}
