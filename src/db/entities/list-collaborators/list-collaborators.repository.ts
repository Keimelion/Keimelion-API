import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../client.js'
import { CollabRoles, CONTRIBUTOR_ROLE_VALUES } from '../../../shared/enums/collab-role.js'
import { listCollaborators } from './list-collaborators.schema.js'
import type { ListCollaborator } from './list-collaborators.schema.js'

export function findListOwner(listId: string, userId: string): Promise<ListCollaborator | undefined> {
  return db.query.listCollaborators.findFirst({
    where: and(
      eq(listCollaborators.listId, listId),
      eq(listCollaborators.userId, userId),
      eq(listCollaborators.collabRole, CollabRoles.OWNER),
    ),
  })
}

export function findListContributor(listId: string, userId: string): Promise<ListCollaborator | undefined> {
  return db.query.listCollaborators.findFirst({
    where: and(
      eq(listCollaborators.listId, listId),
      eq(listCollaborators.userId, userId),
      inArray(listCollaborators.collabRole, [...CONTRIBUTOR_ROLE_VALUES]),
    ),
  })
}
