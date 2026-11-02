import { relations } from 'drizzle-orm'
import { reservations } from './reservations.schema.js'
import { listItems } from '../list-items/list-items.schema.js'
import { users } from '../users/users.schema.js'

export const reservationsRelations = relations(reservations, ({ one }) => ({
  listItem: one(listItems, {
    fields: [reservations.listItemId],
    references: [listItems.id],
  }),
  user: one(users, {
    fields: [reservations.userId],
    references: [users.id],
  }),
}))
