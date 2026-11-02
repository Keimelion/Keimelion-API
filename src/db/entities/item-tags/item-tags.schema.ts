import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { items } from '../items/items.schema.js'
import { tags } from '../tags/tags.schema.js'

export const itemTags = pgTable(
  'item_tags',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    primaryKey({ columns: [table.itemId, table.tagId] }),
    index('item_tags_tag_id_idx').on(table.tagId),
  ],
)

export type ItemTag = typeof itemTags.$inferSelect
