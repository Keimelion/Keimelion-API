import { check, index, pgTable, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { uuidPrimaryKey } from '../../../shared/db/columns.js'
import { positiveCheck, positiveSmallInt } from '../../../shared/db/checks.js'
import { SHA256_HEX_LENGTH } from '../../../shared/utils/hash.js'
import { listItems } from '../list-items/list-items.schema.js'
import { users } from '../users/users.schema.js'

export const RESERVER_NAME_MAX_LENGTH = 100

export const RESERVER_EMAIL_MAX_LENGTH = 254

export const reservations = pgTable(
  'reservations',
  {
    id: uuidPrimaryKey(),
    listItemId: uuid('list_item_id')
      .notNull()
      .references(() => listItems.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    reserverName: varchar('reserver_name', { length: RESERVER_NAME_MAX_LENGTH }),
    reserverEmail: varchar('reserver_email', { length: RESERVER_EMAIL_MAX_LENGTH }),
    anonymousTokenHash: varchar('anonymous_token_hash', { length: SHA256_HEX_LENGTH }),
    quantityBooked: positiveSmallInt('quantity_booked').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    unique('reservations_list_item_id_user_id_unique').on(table.listItemId, table.userId),
    uniqueIndex('reservations_anonymous_token_hash_unique').on(table.anonymousTokenHash),
    index('reservations_user_id_idx').on(table.userId),
    index('reservations_list_item_id_idx').on(table.listItemId),
    positiveCheck(table.quantityBooked),
    check(
      'reservations_reserver_identity_check',
      sql`${table.userId} IS NOT NULL OR ${table.reserverName} IS NOT NULL`,
    ),
  ],
)

export type Reservation = typeof reservations.$inferSelect
