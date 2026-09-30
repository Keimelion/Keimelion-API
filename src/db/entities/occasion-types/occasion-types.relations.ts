import { relations } from 'drizzle-orm'
import { occasionTypes, occasionTypeTranslations } from './occasion-types.schema.js'
import { lists } from '../lists/lists.schema.js'

export const occasionTypesRelations = relations(occasionTypes, ({ many }) => ({
  translations: many(occasionTypeTranslations),
  lists: many(lists),
}))

export const occasionTypeTranslationsRelations = relations(occasionTypeTranslations, ({ one }) => ({
  occasionType: one(occasionTypes, {
    fields: [occasionTypeTranslations.occasionTypeId],
    references: [occasionTypes.id],
  }),
}))
