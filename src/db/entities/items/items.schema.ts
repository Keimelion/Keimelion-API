import { pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { users } from '../users/users.schema.js'

export const items = pgTable('items', {
  id: uuidPrimaryKey(),
  name: varchar('name', { length: 300 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps(),
})

export type Item = typeof items.$inferSelect
