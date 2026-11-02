import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import {
  nonEmptyCheck,
  nonEmptyVarchar,
  slugCheck,
  slugVarchar,
} from '../../../shared/db/checks.js'
import { LIST_STATUS_VALUES } from '../../../shared/enums/list-status.js'
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
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [nonEmptyCheck(table.title), slugCheck(table.slug)],
)

export type List = typeof lists.$inferSelect
