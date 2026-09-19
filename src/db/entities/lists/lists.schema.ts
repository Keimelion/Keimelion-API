import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { LIST_STATUS_VALUES } from '../../../shared/enums/list-status.js'
import { occasionTypes } from '../occasion-types/occasion-types.schema.js'

export const listStatusEnum = pgEnum('list_status', LIST_STATUS_VALUES)

export const lists = pgTable('lists', {
  id: uuidPrimaryKey(),
  occasionTypeId: uuid('occasion_type_id').references(() => occasionTypes.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 200 }).notNull().unique(),
  description: text('description'),
  eventDate: timestamp('event_date', { withTimezone: false }),
  listStatus: listStatusEnum('list_status').notNull().default('active'),
  isGalleryPublic: boolean('is_gallery_public').notNull().default(false),
  isTemplate: boolean('is_template').notNull().default(false),
  templateSourceId: uuid('template_source_id'),
  viewCount: integer('view_count').notNull().default(0),
  importCount: integer('import_count').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps(),
})

export type List = typeof lists.$inferSelect
