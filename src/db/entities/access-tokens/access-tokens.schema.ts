import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../users/users.schema.js'

export const accessTokens = pgTable(
  'access_tokens',
  {
    tokenId: uuid('token_id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('access_tokens_expires_at_idx').on(table.expiresAt)],
)

export type AccessToken = typeof accessTokens.$inferSelect
