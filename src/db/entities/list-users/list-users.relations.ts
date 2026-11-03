import { relations } from 'drizzle-orm'
import { listUsers } from './list-users.schema.js'
import { lists } from '../lists/lists.schema.js'
import { users } from '../users/users.schema.js'

export const listUsersRelations = relations(listUsers, ({ one }) => ({
  list: one(lists, {
    fields: [listUsers.listId],
    references: [lists.id],
  }),
  user: one(users, {
    fields: [listUsers.userId],
    references: [users.id],
  }),
}))
