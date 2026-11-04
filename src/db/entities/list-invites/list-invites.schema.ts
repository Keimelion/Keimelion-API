import { sql } from 'drizzle-orm'
import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { INVITE_STATUS_VALUES, InviteStatuses } from '../../../shared/enums/invite-status.js'
import { ListUserRoles } from '../../../shared/enums/list-user-role.js'
import { SHA256_HEX_LENGTH } from '../../../shared/utils/hash.js'
import { listUserRoleEnum } from '../list-users/list-users.schema.js'
import { lists } from '../lists/lists.schema.js'
import { users } from '../users/users.schema.js'

export const inviteStatusEnum = pgEnum('invite_status', INVITE_STATUS_VALUES)

// Interpolated via sql.raw so renaming InviteStatuses.PENDING breaks the build.
const PENDING_STATUS_LITERAL = sql.raw(`'${InviteStatuses.PENDING}'`)

export const listInvites = pgTable(
  'list_invites',
  {
    id: uuidPrimaryKey(),
    listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    invitedEmail: varchar('invited_email', { length: 255 }).notNull(),
    role: listUserRoleEnum('role').notNull().default(ListUserRoles.EDITOR),
    inviteToken: varchar('invite_token', { length: SHA256_HEX_LENGTH }).notNull().unique(),
    inviteTokenExpiresAt: timestamp('invite_token_expires_at', { withTimezone: true }).notNull(),
    inviteStatus: inviteStatusEnum('invite_status').notNull().default(InviteStatuses.PENDING),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('uniq_list_invites_pending_per_list')
      .on(table.listId)
      .where(sql`${table.inviteStatus} = ${PENDING_STATUS_LITERAL}`),
    index('idx_list_invites_list_status').on(table.listId, table.inviteStatus),
    index('idx_list_invites_invited_email').on(table.invitedEmail),
  ],
)

export type ListInvite = typeof listInvites.$inferSelect
