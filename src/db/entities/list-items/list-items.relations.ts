import { relations } from 'drizzle-orm'
import { listItems } from './list-items.schema.js'
import { items } from '../items/items.schema.js'
import { lists } from '../lists/lists.schema.js'

export const listItemsRelations = relations(listItems, ({ one }) => ({
  list: one(lists, {
    fields: [listItems.listId],
    references: [lists.id],
  }),
  item: one(items, {
    fields: [listItems.itemId],
    references: [items.id],
  }),
}))
