import { boolean, pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core'
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

export const occasionTypes = pgTable(
  'occasion_types',
  {
    id: uuidPrimaryKey(),
    slug: slugVarchar('slug', 60).notNull().unique(),
    emoji: varchar('emoji', { length: 10 }),
    sortOrder: nonNegativeSmallInt('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
  (table) => [slugCheck(table.slug), nonNegativeCheck(table.sortOrder)],
)

export const occasionTypeTranslations = pgTable(
  'occasion_type_translations',
  {
    occasionTypeId: uuid('occasion_type_id')
      .notNull()
      .references(() => occasionTypes.id, { onDelete: 'cascade' }),
    locale: localeEnum('locale').notNull(),
    label: nonEmptyVarchar('label', 100).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.occasionTypeId, table.locale] }),
    nonEmptyCheck(table.label),
  ],
)

export type OccasionType = typeof occasionTypes.$inferSelect
export type OccasionTypeTranslation = typeof occasionTypeTranslations.$inferSelect
