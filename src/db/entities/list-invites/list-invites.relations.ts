import { relations } from 'drizzle-orm'
import { listInvites } from './list-invites.schema.js'
import { lists } from '../lists/lists.schema.js'
import { users } from '../users/users.schema.js'

export const listInvitesRelations = relations(listInvites, ({ one }) => ({
  list: one(lists, {
    fields: [listInvites.listId],
    references: [lists.id],
  }),
  invitedByUser: one(users, {
    fields: [listInvites.invitedByUserId],
    references: [users.id],
    relationName: 'listInviteInvitedBy',
  }),
  acceptedByUser: one(users, {
    fields: [listInvites.acceptedByUserId],
    references: [users.id],
    relationName: 'listInviteAcceptedBy',
  }),
}))
