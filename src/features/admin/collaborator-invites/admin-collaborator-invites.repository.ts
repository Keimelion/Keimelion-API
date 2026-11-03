import { and, count, desc, eq, type SQL } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { listCollaborators } from '../../../db/entities/list-collaborators/list-collaborators.schema.js'
import { CollabRoles } from '../../../shared/enums/collab-role.js'
import type { InviteStatus } from '../../../shared/enums/invite-status.js'
import type { User } from '../../../db/entities/users/users.schema.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { ListCollaborator } from '../../../db/entities/list-collaborators/list-collaborators.schema.js'
import { getOffset } from '../../../shared/schemas/pagination.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'

export interface AdminCollaboratorInviteRow extends ListCollaborator {
  user: User | null
  list: List
}

export interface AdminCollaboratorInviteFilters {
  inviteStatus?: InviteStatus | undefined
}

export function findAllCollaboratorInvites(
  pagination: PaginationInput,
  filters: AdminCollaboratorInviteFilters,
): Promise<AdminCollaboratorInviteRow[]> {
  const offset = getOffset(pagination)
  return db.query.listCollaborators.findMany({
    where: buildInviteWhere(filters),
    orderBy: [desc(listCollaborators.createdAt)],
    limit: pagination.limit,
    offset,
    with: { user: true, list: true },
  })
}

export async function countCollaboratorInvites(
  filters: AdminCollaboratorInviteFilters,
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(listCollaborators)
    .where(buildInviteWhere(filters))
  return row?.count ?? 0
}

function buildInviteWhere(filters: AdminCollaboratorInviteFilters): SQL | undefined {
  const editorClause = eq(listCollaborators.collabRole, CollabRoles.EDITOR)
  if (filters.inviteStatus === undefined) return editorClause
  return and(editorClause, eq(listCollaborators.inviteStatus, filters.inviteStatus))
}
