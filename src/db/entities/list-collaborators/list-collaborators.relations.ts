import { relations } from 'drizzle-orm'
import { listCollaborators } from './list-collaborators.schema.js'
import { lists } from '../lists/lists.schema.js'
import { users } from '../users/users.schema.js'

export const listCollaboratorsRelations = relations(listCollaborators, ({ one }) => ({
  list: one(lists, {
    fields: [listCollaborators.listId],
    references: [lists.id],
  }),
  user: one(users, {
    fields: [listCollaborators.userId],
    references: [users.id],
  }),
}))
