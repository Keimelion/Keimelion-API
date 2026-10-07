import { and, count, eq, inArray, isNull, type SQL } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { lists } from '../../db/entities/lists/lists.schema.js'
import { listCollaborators } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import { CollabRoles } from '../../shared/enums/collab-role.js'
import { defineEntity } from '../../shared/db/entity-descriptor.js'
import { LIST_WITH_OWNER } from './lists.includes.js'
import type { ListRowWithOwner } from '../../shared/types/list.js'
import type { PaginationInput } from '../../shared/schemas/pagination.js'
import type { SortInput } from '../../shared/schemas/sort.js'

export const userListsEntity = defineEntity({
  sortable: {
    createdAt:  lists.createdAt,
    updatedAt:  lists.updatedAt,
    title:      lists.title,
    listStatus: lists.listStatus,
  },
  defaultSort: [{ field: 'createdAt', direction: 'desc' }],
  filterable: {},
})

export type UserListsSortField = keyof typeof userListsEntity.sortable

export async function findListsOwnedBy(
  userId: string,
  pagination: PaginationInput,
  sort: SortInput<UserListsSortField> | undefined,
): Promise<ListRowWithOwner[]> {
  const offset = (pagination.page - 1) * pagination.limit
  return db.query.lists.findMany({
    where: ownedListsWhere(userId),
    orderBy: userListsEntity.buildOrderBy(sort),
    limit: pagination.limit,
    offset,
    with: LIST_WITH_OWNER,
  })
}

export async function countListsOwnedBy(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(lists)
    .where(ownedListsWhere(userId))
  return row?.count ?? 0
}

function ownedListsWhere(userId: string): SQL | undefined {
  const ownedListIds = db
    .select({ id: listCollaborators.listId })
    .from(listCollaborators)
    .where(and(eq(listCollaborators.userId, userId), eq(listCollaborators.collabRole, CollabRoles.OWNER)))
  return and(isNull(lists.deletedAt), inArray(lists.id, ownedListIds))
}
