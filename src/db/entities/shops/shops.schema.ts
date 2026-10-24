import { boolean, index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { isNotNull } from 'drizzle-orm'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import {
  nonEmptyCheck,
  nonEmptyVarchar,
  nonNegativeCheck,
  nonNegativeSmallInt,
  slugCheck,
  slugVarchar,
} from '../../../shared/db/checks.js'

export const shops = pgTable(
  'shops',
  {
    id: uuidPrimaryKey(),
    slug: slugVarchar('slug', 60).notNull().unique(),
    name: nonEmptyVarchar('name', 120).notNull(),
    domain: nonEmptyVarchar('domain', 253),
    logoUrl: text('logo_url'),
    isAffiliated: boolean('is_affiliated').notNull().default(false),
    sortOrder: nonNegativeSmallInt('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('shops_domain_unique_idx').on(table.domain).where(isNotNull(table.domain)),
    index('shops_sort_order_idx').on(table.sortOrder),
    slugCheck(table.slug),
    nonEmptyCheck(table.name),
    nonNegativeCheck(table.sortOrder),
  ],
)

export type Shop = typeof shops.$inferSelect
