import { boolean, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const platformRoleEnum = pgEnum('platform_role', ['user', 'admin'])
export const authProviderEnum = pgEnum('auth_provider', ['email', 'google'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
  passwordHash: text('password_hash'),
  authProvider: authProviderEnum('auth_provider').notNull(),
  platformRole: platformRoleEnum('platform_role').notNull().default('user'),
  isCgvAccepted: boolean('is_cgv_accepted').notNull().default(false),
  cgvAcceptedAt: timestamp('cgv_accepted_at', { withTimezone: true }),
  isMarketingOptedIn: boolean('is_marketing_opted_in').notNull().default(false),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  banReason: text('ban_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
})
