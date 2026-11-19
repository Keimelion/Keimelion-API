import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../shared/db/columns.js'
import { lists } from '../lists/lists.schema.js'
import { tags } from '../tags/tags.schema.js'
import type { Tag } from '../tags/tags.schema.js'

export const listTags = pgTable(
  'list_tags',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.tagId] }),
    index('list_tags_tag_id_idx').on(table.tagId),
  ],
)

export type ListTag = typeof listTags.$inferSelect

export interface ListTagWithTag extends ListTag {
  tag: Tag
}
