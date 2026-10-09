import { relations } from 'drizzle-orm'
import { itemTags } from './item-tags.schema.js'
import { items } from '../items/items.schema.js'
import { tags } from '../tags/tags.schema.js'

export const itemTagsRelations = relations(itemTags, ({ one }) => ({
  item: one(items, {
    fields: [itemTags.itemId],
    references: [items.id],
  }),
  tag: one(tags, {
    fields: [itemTags.tagId],
    references: [tags.id],
  }),
}))
