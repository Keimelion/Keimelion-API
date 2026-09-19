import { and, eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { listCollaborators } from './list-collaborators.schema.js'
import type { ListCollaborator } from './list-collaborators.schema.js'

export function findListOwner(listId: string, userId: string): Promise<ListCollaborator | undefined> {
  return db.query.listCollaborators.findFirst({
    where: and(
      eq(listCollaborators.listId, listId),
      eq(listCollaborators.userId, userId),
      eq(listCollaborators.collabRole, 'owner'),
    ),
  })
}
