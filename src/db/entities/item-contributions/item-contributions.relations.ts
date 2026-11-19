import { relations } from 'drizzle-orm'
import { itemContributions } from './item-contributions.schema.js'
import { items } from '../items/items.schema.js'
import { users } from '../users/users.schema.js'

export const itemContributionsRelations = relations(itemContributions, ({ one }) => ({
  item: one(items, {
    fields: [itemContributions.itemId],
    references: [items.id],
  }),
  user: one(users, {
    fields: [itemContributions.userId],
    references: [users.id],
  }),
}))
