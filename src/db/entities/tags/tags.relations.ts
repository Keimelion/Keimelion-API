import { relations } from 'drizzle-orm'
import { tags } from './tags.schema.js'
import { users } from '../users/users.schema.js'
import { itemTags } from '../item-tags/item-tags.schema.js'

export const tagsRelations = relations(tags, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [tags.createdByUserId],
    references: [users.id],
  }),
  itemTags: many(itemTags),
}))
