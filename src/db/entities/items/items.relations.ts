import { relations } from 'drizzle-orm'
import { items } from './items.schema.js'
import { users } from '../users/users.schema.js'
import { itemSources } from '../item-sources/item-sources.schema.js'
import { listItems } from '../list-items/list-items.schema.js'
import { itemCategories } from '../item-categories/item-categories.schema.js'

export const itemsRelations = relations(items, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [items.createdByUserId],
    references: [users.id],
  }),
  sources: many(itemSources),
  listItems: many(listItems),
  itemCategories: many(itemCategories),
}))
