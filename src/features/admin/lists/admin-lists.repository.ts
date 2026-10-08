import { and, count, eq, inArray, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/client.js'
import { lists } from '../../../db/entities/lists/lists.schema.js'
import { listCollaborators } from '../../../db/entities/list-collaborators/list-collaborators.schema.js'
import {
  LIST_DEFAULT_SORT,
  LIST_SORTABLE_FIELDS,
  LIST_WITH_OWNER,
  findListById,
  findListWithOwner,
} from '../../../db/entities/lists/lists.repository.js'
import { CollabRoles } from '../../../shared/enums/collab-role.js'
import { defineEntity, buildSoftDeleteDefault } from '../../../shared/db/entity-descriptor.js'
import { LIST_STATUS_VALUES } from '../../../shared/enums/list-status.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { ListRowWithOwner } from '../../../shared/types/list.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'

const listStatusSchema = z.enum(LIST_STATUS_VALUES)
const occasionTypeIdSchema = z.string().uuid()

export const listsEntity = defineEntity({
  sortable: LIST_SORTABLE_FIELDS,
  defaultSort: LIST_DEFAULT_SORT,
  filterable: {
    listStatus:     { column: lists.listStatus,     operators: ['eq', 'in'],   valueSchema: listStatusSchema },
    occasionTypeId: { column: lists.occasionTypeId, operators: ['eq', 'isNull'], valueSchema: occasionTypeIdSchema },
    createdAt:      { column: lists.createdAt, operators: ['gte', 'lte', 'between'], valueType: 'date' },
    updatedAt:      { column: lists.updatedAt, operators: ['gte', 'lte', 'between'], valueType: 'date' },
    deletedAt:      { column: lists.deletedAt, operators: ['isNull'] },
  },
})

export type ListsSortField = keyof typeof listsEntity.sortable

export interface ListListsFilters {
  sort?: SortInput<ListsSortField> | undefined
  genericFilters?: FilterInput[] | undefined
  ownerListIds?: string[] | undefined
}

export function findAllListsWithOwner(
  input: PaginationInput,
  filters: ListListsFilters,
): Promise<ListRowWithOwner[]> {
  const offset = (input.page - 1) * input.limit
  return db.query.lists.findMany({
    where: buildListsWhere(filters),
    orderBy: listsEntity.buildOrderBy(filters.sort),
    limit: input.limit,
    offset,
    with: LIST_WITH_OWNER,
  })
}

export async function countLists(filters: ListListsFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(lists)
    .where(buildListsWhere(filters))
  return row?.count ?? 0
}

export function findAdminListById(id: string): Promise<List | undefined> {
  return findListById(id, { includeDeleted: true })
}

export function findAdminListByIdWithOwner(id: string): Promise<ListRowWithOwner | undefined> {
  return findListWithOwner(id)
}

export async function findListIdsByOwnerUserId(ownerUserId: string): Promise<string[]> {
  const rows = await db
    .select({ listId: listCollaborators.listId })
    .from(listCollaborators)
    .where(and(eq(listCollaborators.userId, ownerUserId), eq(listCollaborators.collabRole, CollabRoles.OWNER)))
  return rows.map((row) => row.listId)
}

function buildListsWhere(filters: ListListsFilters): SQL | undefined {
  const generic = filters.genericFilters ?? []
  const genericClause = generic.length > 0 ? listsEntity.buildWhere(generic) : undefined
  const ownerClause = filters.ownerListIds !== undefined ? inArray(lists.id, filters.ownerListIds) : undefined
  return and(buildSoftDeleteDefault(generic, lists.deletedAt), genericClause, ownerClause)
}
