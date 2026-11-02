import { index, pgTable, uuid } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import {
  nonEmptyCheck,
  nonEmptyVarchar,
  slugCheck,
  slugVarchar,
} from '../../../shared/db/checks.js'
import { users } from '../users/users.schema.js'

export const MAX_TAG_NAME_LENGTH = 50
export const MAX_TAG_SLUG_LENGTH = 50

export const tags = pgTable(
  'tags',
  {
    id: uuidPrimaryKey(),
    name: nonEmptyVarchar('name', MAX_TAG_NAME_LENGTH).notNull(),
    slug: slugVarchar('slug', MAX_TAG_SLUG_LENGTH).notNull().unique(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps(),
  },
  (table) => [
    index('tags_created_by_user_id_idx').on(table.createdByUserId),
    nonEmptyCheck(table.name),
    slugCheck(table.slug),
  ],
)

export type Tag = typeof tags.$inferSelect
