import { pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { uuidPrimaryKey } from '../../../shared/db/columns.js'
import { lists } from '../lists/lists.schema.js'
import { users } from '../users/users.schema.js'

export const collabRoleEnum = pgEnum('collab_role', ['owner', 'editor', 'viewer'])

export const listCollaborators = pgTable('list_collaborators', {
  id: uuidPrimaryKey(),
  listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  invitedEmail: varchar('invited_email', { length: 255 }),
  collabRole: collabRoleEnum('collab_role').notNull().default('editor'),
  inviteStatus: varchar('invite_status', { length: 20 }).notNull().default('pending'),
  inviteToken: uuid('invite_token').unique(),
  inviteTokenExpiresAt: timestamp('invite_token_expires_at', { withTimezone: true }),
  invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().default(sql`now()`),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export type ListCollaborator = typeof listCollaborators.$inferSelect
