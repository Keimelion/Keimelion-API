import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { lists } from '../lists/lists.schema.js'
import { tags } from '../tags/tags.schema.js'

export const listTags = pgTable(
  'list_tags',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.tagId] }),
    index('list_tags_tag_id_idx').on(table.tagId),
  ],
)

export type ListTag = typeof listTags.$inferSelect
