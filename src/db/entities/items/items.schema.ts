import { char, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { users } from '../users/users.schema.js'

export const items = pgTable('items', {
  id: uuidPrimaryKey(),
  name: varchar('name', { length: 300 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  locale: char('locale', { length: 5 }).notNull().default('fr'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  moderationStatus: varchar('moderation_status', { length: 20 }).notNull().default('approved'),
  addCount: integer('add_count').notNull().default(0),
  reserveCount: integer('reserve_count').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps(),
})

export type Item = typeof items.$inferSelect
