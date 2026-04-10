import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

export const tokenBlacklist = pgTable(
  'token_blacklist',
  {
    jti: uuid('jti').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('token_blacklist_expires_at_idx').on(table.expiresAt)],
)

export type TokenBlacklistEntry = typeof tokenBlacklist.$inferSelect
