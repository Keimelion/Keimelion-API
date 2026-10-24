import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { uuidPrimaryKey } from '../../../shared/db/columns.js'
import { positiveCheck, positiveSmallInt } from '../../../shared/db/checks.js'
import { listItems } from '../list-items/list-items.schema.js'
import { users } from '../users/users.schema.js'

export const reservations = pgTable(
  'reservations',
  {
    id: uuidPrimaryKey(),
    listItemId: uuid('list_item_id')
      .notNull()
      .references(() => listItems.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    quantityBooked: positiveSmallInt('quantity_booked').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    unique('reservations_list_item_id_user_id_unique').on(table.listItemId, table.userId),
    index('reservations_user_id_idx').on(table.userId),
    index('reservations_list_item_id_idx').on(table.listItemId),
    positiveCheck(table.quantityBooked),
  ],
)

export type Reservation = typeof reservations.$inferSelect
