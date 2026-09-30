import { relations } from 'drizzle-orm'
import { lists } from './lists.schema.js'
import { occasionTypes } from '../occasion-types/occasion-types.schema.js'
import { listCollaborators } from '../list-collaborators/list-collaborators.schema.js'
import { listItems } from '../list-items/list-items.schema.js'

export const listsRelations = relations(lists, ({ one, many }) => ({
  occasionType: one(occasionTypes, {
    fields: [lists.occasionTypeId],
    references: [occasionTypes.id],
  }),
  collaborators: many(listCollaborators),
  listItems: many(listItems),
}))
