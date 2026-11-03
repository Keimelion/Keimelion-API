import { relations } from 'drizzle-orm'
import { lists } from './lists.schema.js'
import { occasionTypes } from '../occasion-types/occasion-types.schema.js'
import { listUsers } from '../list-users/list-users.schema.js'
import { listInvites } from '../list-invites/list-invites.schema.js'
import { listItems } from '../list-items/list-items.schema.js'
import { listTags } from '../list-tags/list-tags.schema.js'

export const listsRelations = relations(lists, ({ one, many }) => ({
  occasionType: one(occasionTypes, {
    fields: [lists.occasionTypeId],
    references: [occasionTypes.id],
  }),
  listUsers: many(listUsers),
  listInvites: many(listInvites),
  listItems: many(listItems),
  listTags: many(listTags),
}))
