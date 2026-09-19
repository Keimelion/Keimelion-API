import { boolean, char, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { eq } from 'drizzle-orm'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { items } from '../items/items.schema.js'

export const itemSources = pgTable(
  'item_sources',
  {
    id: uuidPrimaryKey(),
    itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
    sourceUrl: text('source_url'),
    price: numeric('price', { precision: 10, scale: 2 }),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    isDomainTrusted: boolean('is_domain_trusted').notNull().default(false),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('item_sources_primary_idx').on(table.itemId).where(eq(table.isPrimary, true)),
  ],
)

export type ItemSource = typeof itemSources.$inferSelect
