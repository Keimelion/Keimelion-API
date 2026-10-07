import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { lists } from '../../db/entities/lists/lists.schema.js'
import { listCollaborators } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import { CollabRoles } from '../../shared/enums/collab-role.js'
import { defineEntity } from '../../shared/db/entity-descriptor.js'
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

const LIST_WITH_OWNER = {
  collaborators: {
    where: eq(listCollaborators.collabRole, CollabRoles.OWNER),
    limit: 1,
    with: { user: true },
  },
} as const

export async function findListsOwnedBy(
  userId: string,
  pagination: PaginationInput,
  sort: SortInput<UserListsSortField> | undefined,
): Promise<ListRowWithOwner[]> {
  const ownedListIds = await findOwnedListIds(userId)
  if (ownedListIds.length === 0) return []

  const offset = (pagination.page - 1) * pagination.limit
  return db.query.lists.findMany({
    where: and(inArray(lists.id, ownedListIds), isNull(lists.deletedAt)),
    orderBy: userListsEntity.buildOrderBy(sort),
    limit: pagination.limit,
    offset,
    with: LIST_WITH_OWNER,
  })
}

export async function countListsOwnedBy(userId: string): Promise<number> {
  const ownedListIds = await findOwnedListIds(userId)
  if (ownedListIds.length === 0) return 0

  const [row] = await db
    .select({ count: count() })
    .from(lists)
    .where(and(inArray(lists.id, ownedListIds), isNull(lists.deletedAt)))
  return row?.count ?? 0
}

async function findOwnedListIds(userId: string): Promise<string[]> {
  const rows = await db.query.listCollaborators.findMany({
    where: and(eq(listCollaborators.userId, userId), eq(listCollaborators.collabRole, CollabRoles.OWNER)),
    columns: { listId: true },
  })
  return rows.map((row) => row.listId)
}
