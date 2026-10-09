import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { items } from '../items/items.schema.js'
import { categories } from '../categories/categories.schema.js'

export const itemCategories = pgTable(
  'item_categories',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.categoryId] })],
)

export type ItemCategory = typeof itemCategories.$inferSelect
