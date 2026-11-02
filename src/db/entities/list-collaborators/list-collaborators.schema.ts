import { index, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { COLLAB_ROLE_VALUES, CollabRoles } from '../../../shared/enums/collab-role.js'
import { INVITE_STATUS_VALUES, InviteStatuses } from '../../../shared/enums/invite-status.js'
import { lists } from '../lists/lists.schema.js'
import { users } from '../users/users.schema.js'

export const collabRoleEnum = pgEnum('collab_role', COLLAB_ROLE_VALUES)
export const inviteStatusEnum = pgEnum('invite_status', INVITE_STATUS_VALUES)

export const listCollaborators = pgTable(
  'list_collaborators',
  {
    id: uuidPrimaryKey(),
    listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    invitedEmail: varchar('invited_email', { length: 255 }),
    collabRole: collabRoleEnum('collab_role').notNull().default(CollabRoles.EDITOR),
    inviteStatus: inviteStatusEnum('invite_status').notNull().default(InviteStatuses.PENDING),
    inviteToken: uuid('invite_token').unique(),
    inviteTokenExpiresAt: timestamp('invite_token_expires_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index('idx_list_collaborators_user_role').on(table.userId, table.collabRole),
    index('idx_list_collaborators_list_role').on(table.listId, table.collabRole),
  ],
)

export type ListCollaborator = typeof listCollaborators.$inferSelect
