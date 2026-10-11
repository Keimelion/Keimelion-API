import { relations } from 'drizzle-orm'
import { listTags } from './list-tags.schema.js'
import { lists } from '../lists/lists.schema.js'
import { tags } from '../tags/tags.schema.js'

export const listTagsRelations = relations(listTags, ({ one }) => ({
  list: one(lists, {
    fields: [listTags.listId],
    references: [lists.id],
  }),
  tag: one(tags, {
    fields: [listTags.tagId],
    references: [tags.id],
  }),
}))
