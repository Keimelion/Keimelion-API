import { relations } from 'drizzle-orm'
import { shops } from './shops.schema.js'
import { itemSources } from '../item-sources/item-sources.schema.js'

export const shopsRelations = relations(shops, ({ many }) => ({
  sources: many(itemSources),
}))
