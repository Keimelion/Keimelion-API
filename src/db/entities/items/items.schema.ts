import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { nonEmptyCheck, nonEmptyVarchar } from '../../../shared/db/checks.js'
import { users } from '../users/users.schema.js'

export const items = pgTable(
  'items',
  {
    id: uuidPrimaryKey(),
    name: nonEmptyVarchar('name', 300).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (table) => [nonEmptyCheck(table.name)],
)

export type Item = typeof items.$inferSelect
