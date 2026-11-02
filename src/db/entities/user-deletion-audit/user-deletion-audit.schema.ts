import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { nonEmptyCheck, nonEmptyVarchar } from '../../../shared/db/checks.js'
import { DELETION_REASON_VALUES } from '../../../shared/enums/deletion-reason.js'

export const deletionReasonEnum = pgEnum('deletion_reason', DELETION_REASON_VALUES)

export const userDeletionAudit = pgTable(
  'user_deletion_audit',
  {
    id: uuidPrimaryKey(),
    userId: uuid('user_id').notNull(),
    email: nonEmptyVarchar('email', 255).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    hardDeletedAt: timestamp('hard_deleted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    reason: deletionReasonEnum('reason').notNull(),
    ...timestamps(),
  },
  (table) => [nonEmptyCheck(table.email)],
)

export type UserDeletionAudit = typeof userDeletionAudit.$inferSelect
