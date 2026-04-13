import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../users/users.schema.js'

export const activeTokens = pgTable(
  'active_tokens',
  {
    jti: uuid('jti').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('active_tokens_expires_at_idx').on(table.expiresAt)],
)

export type ActiveToken = typeof activeTokens.$inferSelect
