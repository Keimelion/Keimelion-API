import { and, eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { ListUserRoles } from '../../../shared/enums/list-user-role.js'
import type { ListUserRole } from '../../../shared/enums/list-user-role.js'
import { listUsers } from './list-users.schema.js'
import type { ListUser } from './list-users.schema.js'

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export function findActiveEditorForList(listId: string): Promise<ListUser | undefined> {
  return db.query.listUsers.findFirst({
    where: and(eq(listUsers.listId, listId), eq(listUsers.role, ListUserRoles.EDITOR)),
  })
}

export async function insertListUser(
  listId: string,
  userId: string,
  role: ListUserRole,
  tx?: DbOrTx,
): Promise<ListUser | undefined> {
  const executor = tx ?? db
  const [row] = await executor.insert(listUsers).values({ listId, userId, role }).returning()
  return row
}
