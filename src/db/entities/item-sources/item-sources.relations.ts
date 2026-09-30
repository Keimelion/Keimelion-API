import { relations } from 'drizzle-orm'
import { itemSources } from './item-sources.schema.js'
import { items } from '../items/items.schema.js'
import { shops } from '../shops/shops.schema.js'

export const itemSourcesRelations = relations(itemSources, ({ one }) => ({
  item: one(items, {
    fields: [itemSources.itemId],
    references: [items.id],
  }),
  shop: one(shops, {
    fields: [itemSources.shopId],
    references: [shops.id],
  }),
}))
