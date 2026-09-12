import { boolean, pgTable, smallint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const occasionTypes = pgTable('occasion_types', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar('slug', { length: 60 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  emoji: varchar('emoji', { length: 10 }),
  sortOrder: smallint('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export type OccasionType = typeof occasionTypes.$inferSelect
