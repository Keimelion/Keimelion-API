import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../../client.js'
import { CONTRIBUTOR_ROLE_VALUES, ListUserRoles } from '../../../shared/enums/list-user-role.js'
import { listUsers } from './list-users.schema.js'
import type { ListUser } from './list-users.schema.js'
import type { User } from '../users/users.schema.js'

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface ListUserWithUserRow extends ListUser {
  user: User | null
}

export function findListOwner(listId: string, userId: string): Promise<ListUser | undefined> {
  return db.query.listUsers.findFirst({
    where: and(
      eq(listUsers.listId, listId),
      eq(listUsers.userId, userId),
      eq(listUsers.role, ListUserRoles.OWNER),
    ),
  })
}

export function findListContributor(listId: string, userId: string): Promise<ListUser | undefined> {
  return db.query.listUsers.findFirst({
    where: and(
      eq(listUsers.listId, listId),
      eq(listUsers.userId, userId),
      inArray(listUsers.role, [...CONTRIBUTOR_ROLE_VALUES]),
    ),
  })
}

export function findActiveEditorForList(listId: string): Promise<ListUser | undefined> {
  return db.query.listUsers.findFirst({
    where: and(eq(listUsers.listId, listId), eq(listUsers.role, ListUserRoles.EDITOR)),
  })
}

export function findListUsersForListsWithUser(listIds: string[]): Promise<ListUserWithUserRow[]> {
  if (listIds.length === 0) return Promise.resolve([])
  return db.query.listUsers.findMany({
    where: inArray(listUsers.listId, listIds),
    orderBy: [asc(listUsers.createdAt)],
    with: { user: true },
  })
}

export async function insertOwnerListUser(
  listId: string,
  userId: string,
  tx?: DbOrTx,
): Promise<ListUser | undefined> {
  const executor = tx ?? db
  const [row] = await executor
    .insert(listUsers)
    .values({
      listId,
      userId,
      role: ListUserRoles.OWNER,
    })
    .returning()
  return row
}

export async function insertEditorListUser(
  listId: string,
  userId: string,
  tx?: DbOrTx,
): Promise<ListUser | undefined> {
  const executor = tx ?? db
  const [row] = await executor
    .insert(listUsers)
    .values({
      listId,
      userId,
      role: ListUserRoles.EDITOR,
    })
    .returning()
  return row
}
