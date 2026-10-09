import {
  type AnyPgColumn,
  index,
  pgTable,
  smallint,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'

export const MAX_CATEGORY_NAME_LENGTH = 120
export const MAX_CATEGORY_SLUG_LENGTH = 80

export const categories = pgTable(
  'categories',
  {
    id: uuidPrimaryKey(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: MAX_CATEGORY_NAME_LENGTH }).notNull(),
    slug: varchar('slug', { length: MAX_CATEGORY_SLUG_LENGTH }).notNull().unique(),
    depth: smallint('depth').notNull().default(0),
    ...timestamps(),
  },
  (table) => [index('categories_parent_id_idx').on(table.parentId)],
)

export type Category = typeof categories.$inferSelect
