import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'

export const userDeletionAudit = pgTable('user_deletion_audit', {
  id: uuidPrimaryKey(),
  userId: uuid('user_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  hardDeletedAt: timestamp('hard_deleted_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  reason: varchar('reason', { length: 30 }).notNull(),
  ...timestamps(),
})

export type UserDeletionAudit = typeof userDeletionAudit.$inferSelect
