import { findListUsersForListsWithUser } from '../../db/entities/list-users/list-users.repository.js'
import { findActivePendingInvitesForLists } from '../../db/entities/list-invites/list-invites.repository.js'
import { toMemberSummary, toPendingInviteSummary } from '../../shared/types/collaborator.js'
import { ListUserRoles } from '../../shared/enums/list-user-role.js'
import type { CollaboratorSummary } from '../../shared/types/collaborator.js'

export async function fetchCollaboratorsSummariesByListId(
  listIds: string[],
  now: Date = new Date(),
): Promise<Map<string, CollaboratorSummary[]>> {
  const [memberRows, pendingInvites] = await Promise.all([
    findListUsersForListsWithUser(listIds),
    findActivePendingInvitesForLists(listIds, now),
  ])

  const map = new Map<string, CollaboratorSummary[]>()
  for (const listId of listIds) {
    map.set(listId, [])
  }
  for (const row of memberRows) {
    map.get(row.listId)?.push(toMemberSummary(row))
  }
  for (const invite of pendingInvites) {
    map.get(invite.listId)?.push(toPendingInviteSummary(invite))
  }
  for (const list of map.values()) {
    list.sort(compareCollaborators)
  }
  return map
}

export async function fetchCollaboratorsSummariesForList(
  listId: string,
  now: Date = new Date(),
): Promise<CollaboratorSummary[]> {
  const byListId = await fetchCollaboratorsSummariesByListId([listId], now)
  return byListId.get(listId) ?? []
}

function compareCollaborators(left: CollaboratorSummary, right: CollaboratorSummary): number {
  return rolePriority(left) - rolePriority(right)
}

function rolePriority(summary: CollaboratorSummary): number {
  if (summary.role === ListUserRoles.OWNER) return 0
  if (summary.status === 'accepted') return 1
  return 2
}
