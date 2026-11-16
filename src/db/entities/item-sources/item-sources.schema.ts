import { char, index, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { isNotNull, isNull, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { currencies } from '../currencies/currencies.schema.js'
import { items } from '../items/items.schema.js'
import { shops } from '../shops/shops.schema.js'
import { users } from '../users/users.schema.js'

export const ITEM_SOURCES_ITEM_SHOP_UNIQUE_INDEX = 'item_sources_item_shop_unique_idx'
export const ITEM_SOURCES_SOURCE_URL_UNIQUE_INDEX = 'item_sources_source_url_hash_unique_idx'

// Normalized URLs can exceed the btree entry size limit, so uniqueness is enforced on their hash.
export const sourceUrlHash = (sourceUrl: AnyPgColumn | string): SQL => sql`md5(${sourceUrl})`

export const itemSources = pgTable(
  'item_sources',
  {
    id: uuidPrimaryKey(),
    itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
    shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'set null' }),
    sourceUrl: text('source_url'),
    originalUrl: text('original_url'),
    affiliateUrl: text('affiliate_url'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    price: numeric('price', { precision: 10, scale: 2 }),
    currency: char('currency', { length: 3 })
      .notNull()
      .default('EUR')
      .references(() => currencies.code, { onUpdate: 'cascade', onDelete: 'restrict' }),
    ...timestamps(),
  },
  (table) => [
    index('item_sources_shop_id_idx').on(table.shopId),
    index('item_sources_created_by_user_id_idx').on(table.createdByUserId),
    index('item_sources_pending_affiliate_url_idx')
      .on(table.shopId, table.id)
      .where(isNull(table.affiliateUrl)),
    uniqueIndex(ITEM_SOURCES_ITEM_SHOP_UNIQUE_INDEX)
      .on(table.itemId, table.shopId)
      .where(isNotNull(table.shopId)),
    uniqueIndex(ITEM_SOURCES_SOURCE_URL_UNIQUE_INDEX)
      .on(sourceUrlHash(table.sourceUrl))
      .where(isNotNull(table.sourceUrl)),
  ],
)

export type ItemSource = typeof itemSources.$inferSelect
