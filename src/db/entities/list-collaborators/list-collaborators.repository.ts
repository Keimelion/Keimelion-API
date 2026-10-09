import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../client.js'
import { CollabRoles, CONTRIBUTOR_ROLE_VALUES } from '../../../shared/enums/collab-role.js'
import { listCollaborators } from './list-collaborators.schema.js'
import type { ListCollaborator } from './list-collaborators.schema.js'

const OWNER_INVITE_STATUS = 'accepted'

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

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

export async function insertOwnerCollaborator(
  listId: string,
  userId: string,
  tx?: DbOrTx,
): Promise<ListCollaborator | undefined> {
  const executor = tx ?? db
  const now = new Date()
  const [row] = await executor
    .insert(listCollaborators)
    .values({
      listId,
      userId,
      collabRole: CollabRoles.OWNER,
      inviteStatus: OWNER_INVITE_STATUS,
      acceptedAt: now,
    })
    .returning()
  return row
}
