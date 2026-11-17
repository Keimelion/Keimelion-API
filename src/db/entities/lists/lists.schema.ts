import { date, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import {
  dateRangeCheck,
  nonEmptyCheck,
  nonEmptyVarchar,
  slugCheck,
  slugVarchar,
} from '../../../shared/db/checks.js'
import { LIST_STATUS_VALUES } from '@keimelion/sdk/enums'
import { MAX_LIST_EVENT_DATE, MIN_LIST_EVENT_DATE } from '@keimelion/sdk/schemas'
import { occasionTypes } from '../occasion-types/occasion-types.schema.js'

export const listStatusEnum = pgEnum('list_status', LIST_STATUS_VALUES)

export const lists = pgTable(
  'lists',
  {
    id: uuidPrimaryKey(),
    occasionTypeId: uuid('occasion_type_id').references(() => occasionTypes.id, { onDelete: 'set null' }),
    title: nonEmptyVarchar('title', 200).notNull(),
    slug: slugVarchar('slug', 80).notNull().unique(),
    description: text('description'),
    listStatus: listStatusEnum('list_status').notNull().default('active'),
    eventDate: date('event_date', { mode: 'string' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    nonEmptyCheck(table.title),
    slugCheck(table.slug),
    dateRangeCheck(table.eventDate, { min: MIN_LIST_EVENT_DATE, max: MAX_LIST_EVENT_DATE }),
  ],
)

export type List = typeof lists.$inferSelect
