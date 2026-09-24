import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { ne } from 'drizzle-orm'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { users } from '../users/users.schema.js'
import { MODERATION_STATUS_VALUES } from '../../../shared/enums/moderation-status.js'

export const moderationStatusEnum = pgEnum('moderation_status_enum', MODERATION_STATUS_VALUES)

export const items = pgTable(
  'items',
  {
    id: uuidPrimaryKey(),
    name: varchar('name', { length: 300 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    moderationStatus: moderationStatusEnum('moderation_status').notNull().default('approved'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index('items_moderation_status_idx')
      .on(table.moderationStatus)
      .where(ne(table.moderationStatus, 'approved')),
  ],
)

export type Item = typeof items.$inferSelect
