import { type AnyPgColumn, index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import {
  nonEmptyCheck,
  nonEmptyVarchar,
  nonNegativeCheck,
  nonNegativeSmallInt,
  slugCheck,
  slugVarchar,
} from '../../../shared/db/checks.js'
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
    slug: slugVarchar('slug', MAX_CATEGORY_SLUG_LENGTH).notNull().unique(),
    depth: nonNegativeSmallInt('depth').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index('categories_parent_id_idx').on(table.parentId),
    slugCheck(table.slug),
    nonNegativeCheck(table.depth),
  ],
)

export const categoryTranslations = pgTable(
  'category_translations',
  {
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    locale: localeEnum('locale').notNull(),
    name: nonEmptyVarchar('name', MAX_CATEGORY_NAME_LENGTH).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.categoryId, table.locale] }),
    nonEmptyCheck(table.name),
  ],
)

export type Category = typeof categories.$inferSelect
export type CategoryTranslation = typeof categoryTranslations.$inferSelect
