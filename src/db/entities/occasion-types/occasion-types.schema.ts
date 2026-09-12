import { boolean, pgTable, smallint, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'

export const occasionTypes = pgTable('occasion_types', {
  id: uuidPrimaryKey(),
  slug: varchar('slug', { length: 60 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  emoji: varchar('emoji', { length: 10 }),
  sortOrder: smallint('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps(),
})

export type OccasionType = typeof occasionTypes.$inferSelect
