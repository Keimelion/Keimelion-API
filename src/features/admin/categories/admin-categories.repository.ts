import { count, type SQL } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { categories } from '../../../db/entities/categories/categories.schema.js'
import { defineEntity } from '../../../shared/db/entity-descriptor.js'
import type { Category } from '../../../db/entities/categories/categories.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'

export const categoriesEntity = defineEntity({
  sortable: {
    name:      categories.name,
    slug:      categories.slug,
    depth:     categories.depth,
    createdAt: categories.createdAt,
    updatedAt: categories.updatedAt,
  },
  defaultSort: [
    { field: 'depth', direction: 'asc' },
    { field: 'name',  direction: 'asc' },
  ],
  filterable: {
    name:     { column: categories.name,     operators: ['eq', 'ilike'] },
    slug:     { column: categories.slug,     operators: ['eq', 'ilike'] },
    depth:    { column: categories.depth,    operators: ['eq'], valueType: 'number' },
    parentId: { column: categories.parentId, operators: ['eq', 'isNull'] },
  },
})

export type CategoriesSortField = keyof typeof categoriesEntity.sortable

export interface ListCategoriesFilters {
  sort?: SortInput<CategoriesSortField> | undefined
  genericFilters?: FilterInput[] | undefined
}

function buildCategoriesWhere(filters: ListCategoriesFilters): SQL | undefined {
  const generic = filters.genericFilters ?? []
  if (generic.length === 0) return undefined
  return categoriesEntity.buildWhere(generic)
}

export function findAllCategories(
  input: PaginationInput,
  filters: ListCategoriesFilters,
): Promise<Category[]> {
  const offset = (input.page - 1) * input.limit
  return db.query.categories.findMany({
    where: buildCategoriesWhere(filters),
    orderBy: categoriesEntity.buildOrderBy(filters.sort),
    limit: input.limit,
    offset,
  })
}

export async function countCategories(filters: ListCategoriesFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(categories)
    .where(buildCategoriesWhere(filters))
  return row?.count ?? 0
}
