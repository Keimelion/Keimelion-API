import { char, index, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { isNotNull } from 'drizzle-orm'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { items } from '../items/items.schema.js'
import { shops } from '../shops/shops.schema.js'

export const itemSources = pgTable(
  'item_sources',
  {
    id: uuidPrimaryKey(),
    itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
    shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'set null' }),
    sourceUrl: text('source_url'),
    price: numeric('price', { precision: 10, scale: 2 }),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    ...timestamps(),
  },
  (table) => [
    index('item_sources_shop_id_idx').on(table.shopId),
    uniqueIndex('item_sources_item_shop_unique_idx')
      .on(table.itemId, table.shopId)
      .where(isNotNull(table.shopId)),
  ],
)

export type ItemSource = typeof itemSources.$inferSelect
