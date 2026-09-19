import { pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { LIST_STATUS_VALUES } from '../../../shared/enums/list-status.js'
import { occasionTypes } from '../occasion-types/occasion-types.schema.js'

export const listStatusEnum = pgEnum('list_status', LIST_STATUS_VALUES)

export const lists = pgTable('lists', {
  id: uuidPrimaryKey(),
  occasionTypeId: uuid('occasion_type_id').references(() => occasionTypes.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  listStatus: listStatusEnum('list_status').notNull().default('active'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps(),
})

export type List = typeof lists.$inferSelect
