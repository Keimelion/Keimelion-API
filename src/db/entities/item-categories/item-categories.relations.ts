import { relations } from 'drizzle-orm'
import { itemCategories } from './item-categories.schema.js'
import { items } from '../items/items.schema.js'
import { categories } from '../categories/categories.schema.js'

export const itemCategoriesRelations = relations(itemCategories, ({ one }) => ({
  item: one(items, {
    fields: [itemCategories.itemId],
    references: [items.id],
  }),
  category: one(categories, {
    fields: [itemCategories.categoryId],
    references: [categories.id],
  }),
}))
