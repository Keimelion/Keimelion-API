import {
  type AnyPgColumn,
  index,
  pgTable,
  primaryKey,
  smallint,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { localeEnum } from '../../../shared/db/translations.js'

export const MAX_CATEGORY_NAME_LENGTH = 120
export const MAX_CATEGORY_SLUG_LENGTH = 80

export const categories = pgTable(
  'categories',
  {
    id: uuidPrimaryKey(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'cascade',
    }),
    slug: varchar('slug', { length: MAX_CATEGORY_SLUG_LENGTH }).notNull().unique(),
    depth: smallint('depth').notNull().default(0),
    ...timestamps(),
  },
  (table) => [index('categories_parent_id_idx').on(table.parentId)],
)

export const categoryTranslations = pgTable(
  'category_translations',
  {
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    locale: localeEnum('locale').notNull(),
    name: varchar('name', { length: MAX_CATEGORY_NAME_LENGTH }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.categoryId, table.locale] })],
)

export type Category = typeof categories.$inferSelect
export type CategoryTranslation = typeof categoryTranslations.$inferSelect
