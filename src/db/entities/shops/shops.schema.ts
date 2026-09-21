import { boolean, index, pgTable, smallint, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { isNotNull } from 'drizzle-orm'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'

export const shops = pgTable(
  'shops',
  {
    id: uuidPrimaryKey(),
    slug: varchar('slug', { length: 60 }).notNull().unique(),
    name: varchar('name', { length: 120 }).notNull(),
    domain: varchar('domain', { length: 253 }),
    logoUrl: text('logo_url'),
    isAffiliated: boolean('is_affiliated').notNull().default(false),
    sortOrder: smallint('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('shops_domain_unique_idx').on(table.domain).where(isNotNull(table.domain)),
    index('shops_sort_order_idx').on(table.sortOrder),
  ],
)

export type Shop = typeof shops.$inferSelect
