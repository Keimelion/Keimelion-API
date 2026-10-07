import { eq } from 'drizzle-orm'
import { listCollaborators } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import { CollabRoles } from '../../shared/enums/collab-role.js'

export const LIST_WITH_OWNER = {
  collaborators: {
    where: eq(listCollaborators.collabRole, CollabRoles.OWNER),
    limit: 1,
    with: { user: true },
  },
} as const
