import { findActivePendingInvitesForLists } from '../../db/entities/list-invites/list-invites.repository.js'
import { toMemberSummary, toPendingInviteSummary } from '../../shared/types/collaborator.js'
import { ListUserRoles } from '../../shared/enums/list-user-role.js'
import { InviteStatuses } from '../../shared/enums/invite-status.js'
import type { CollaboratorSummary } from '../../shared/types/collaborator.js'
import type { ListRowWithOwner } from '../../shared/types/list.js'

interface CollaboratorSortable {
  summary: CollaboratorSummary
  createdAt: Date
}

// Members come from the already-hydrated `row.listUsers`; only pending invites need a query.
export async function buildCollaboratorsByListId(
  rows: ListRowWithOwner[],
  now: Date = new Date(),
): Promise<Map<string, CollaboratorSummary[]>> {
  const pendingInvites = await findActivePendingInvitesForLists(rows.map((row) => row.id), now)

  const buckets = new Map<string, CollaboratorSortable[]>()
  for (const row of rows) {
    buckets.set(
      row.id,
      row.listUsers.map((member) => ({ summary: toMemberSummary(member), createdAt: member.createdAt })),
    )
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

export async function buildCollaboratorsForList(
  row: ListRowWithOwner,
  now: Date = new Date(),
): Promise<CollaboratorSummary[]> {
  const byListId = await buildCollaboratorsByListId([row], now)
  return byListId.get(row.id) ?? []
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
