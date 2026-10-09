import { index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { users } from '../users/users.schema.js'

export const MAX_TAG_NAME_LENGTH = 50
export const MAX_TAG_SLUG_LENGTH = 50

export const tags = pgTable(
  'tags',
  {
    id: uuidPrimaryKey(),
    name: varchar('name', { length: MAX_TAG_NAME_LENGTH }).notNull(),
    slug: varchar('slug', { length: MAX_TAG_SLUG_LENGTH }).notNull().unique(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps(),
  },
  (table) => [index('tags_created_by_user_id_idx').on(table.createdByUserId)],
)

export type Tag = typeof tags.$inferSelect
