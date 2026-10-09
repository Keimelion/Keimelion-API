import { relations } from 'drizzle-orm'
import { categories } from './categories.schema.js'
import { itemCategories } from '../item-categories/item-categories.schema.js'

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'category_parent',
  }),
  children: many(categories, { relationName: 'category_parent' }),
  itemCategories: many(itemCategories),
}))
