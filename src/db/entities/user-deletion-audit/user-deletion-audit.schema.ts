import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const userDeletionAudit = pgTable('user_deletion_audit', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  hardDeletedAt: timestamp('hard_deleted_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  reason: varchar('reason', { length: 30 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
})

export type UserDeletionAudit = typeof userDeletionAudit.$inferSelect
