import { findCollaboratorsForListsWithUser } from '../../db/entities/list-collaborators/list-collaborators.repository.js'
import { toCollaboratorSummary } from '../../shared/types/collaborator.js'
import type { CollaboratorSummary } from '../../shared/types/collaborator.js'

export async function fetchCollaboratorsSummariesByListId(
  listIds: string[],
  now: Date = new Date(),
): Promise<Map<string, CollaboratorSummary[]>> {
  const rows = await findCollaboratorsForListsWithUser(listIds, now)
  const map = new Map<string, CollaboratorSummary[]>()
  for (const listId of listIds) {
    map.set(listId, [])
  }
  for (const row of rows) {
    const bucket = map.get(row.listId)
    if (!bucket) continue
    bucket.push(toCollaboratorSummary(row))
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
