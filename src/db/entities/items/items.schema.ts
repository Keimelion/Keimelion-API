import { char, check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { isNotNull, sql } from 'drizzle-orm'
import { GTIN_LENGTH } from '@keimelion/sdk/schemas'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { nonEmptyCheck, nonEmptyVarchar } from '../../../shared/db/checks.js'
import { users } from '../users/users.schema.js'
import { images } from '../images/images.schema.js'

export const ITEMS_GTIN_UNIQUE_INDEX = 'items_gtin_unique_idx'

export const items = pgTable(
  'items',
  {
    id: uuidPrimaryKey(),
    name: nonEmptyVarchar('name', 300).notNull(),
    description: text('description'),
    gtin: char('gtin', { length: GTIN_LENGTH }),
    imageId: uuid('image_id').references((): AnyPgColumn => images.id, { onDelete: 'set null' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (table) => [
    nonEmptyCheck(table.name),
    check('gtin_digits_check', sql`${table.gtin} ~ ${sql.raw(`'^[0-9]{${String(GTIN_LENGTH)}}$'`)}`),
    uniqueIndex(ITEMS_GTIN_UNIQUE_INDEX).on(table.gtin).where(isNotNull(table.gtin)),
  ],
)

export type Item = typeof items.$inferSelect
