import { findListUsersForListsWithUser } from '../../db/entities/list-users/list-users.repository.js'
import { findActivePendingInvitesForLists } from '../../db/entities/list-invites/list-invites.repository.js'
import { toMemberSummary, toPendingInviteSummary } from '../../shared/types/collaborator.js'
import { ListUserRoles } from '../../shared/enums/list-user-role.js'
import { InviteStatuses } from '../../shared/enums/invite-status.js'
import type { CollaboratorSummary } from '../../shared/types/collaborator.js'

interface CollaboratorSortable {
  summary: CollaboratorSummary
  createdAt: Date
}

export async function fetchCollaboratorsSummariesByListId(
  listIds: string[],
  now: Date = new Date(),
): Promise<Map<string, CollaboratorSummary[]>> {
  const [memberRows, pendingInvites] = await Promise.all([
    findListUsersForListsWithUser(listIds),
    findActivePendingInvitesForLists(listIds, now),
  ])

  const buckets = new Map<string, CollaboratorSortable[]>()
  for (const listId of listIds) {
    buckets.set(listId, [])
  }
  for (const row of memberRows) {
    buckets.get(row.listId)?.push({ summary: toMemberSummary(row), createdAt: row.createdAt })
  }
  for (const invite of pendingInvites) {
    buckets.get(invite.listId)?.push({
      summary: toPendingInviteSummary(invite),
      createdAt: invite.createdAt,
    })
  }

  const result = new Map<string, CollaboratorSummary[]>()
  for (const [listId, bucket] of buckets) {
    bucket.sort(compareSortable)
    result.set(listId, bucket.map((entry) => entry.summary))
  }
  return result
}

export async function fetchCollaboratorsSummariesForList(
  listId: string,
  now: Date = new Date(),
): Promise<CollaboratorSummary[]> {
  const byListId = await fetchCollaboratorsSummariesByListId([listId], now)
  return byListId.get(listId) ?? []
}

function compareSortable(left: CollaboratorSortable, right: CollaboratorSortable): number {
  const priorityDiff = rolePriority(left.summary) - rolePriority(right.summary)
  if (priorityDiff !== 0) return priorityDiff
  return left.createdAt.getTime() - right.createdAt.getTime()
}

function rolePriority(summary: CollaboratorSummary): number {
  if (summary.role === ListUserRoles.OWNER) return 0
  if (summary.status === InviteStatuses.ACCEPTED) return 1
  return 2
}
