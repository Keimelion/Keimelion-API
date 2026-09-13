import { boolean, pgTable, primaryKey, smallint, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { localeEnum } from '../../../shared/db/translations.js'

export const occasionTypes = pgTable('occasion_types', {
  id: uuidPrimaryKey(),
  slug: varchar('slug', { length: 60 }).notNull().unique(),
  emoji: varchar('emoji', { length: 10 }),
  sortOrder: smallint('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps(),
})

export const occasionTypeTranslations = pgTable(
  'occasion_type_translations',
  {
    occasionTypeId: uuid('occasion_type_id')
      .notNull()
      .references(() => occasionTypes.id, { onDelete: 'cascade' }),
    locale: localeEnum('locale').notNull(),
    label: varchar('label', { length: 100 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.occasionTypeId, table.locale] })],
)

export type OccasionType = typeof occasionTypes.$inferSelect
export type OccasionTypeTranslation = typeof occasionTypeTranslations.$inferSelect
