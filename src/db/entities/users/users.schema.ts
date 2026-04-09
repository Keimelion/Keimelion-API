import { boolean, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { USER_ROLE_VALUES } from '../../../shared/enums/user-role.js'
import { AUTH_PROVIDER_VALUES } from '../../../shared/enums/auth-provider.js'

export const userRoleEnum = pgEnum('user_role', USER_ROLE_VALUES)
export const authProviderEnum = pgEnum('auth_provider', AUTH_PROVIDER_VALUES)

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  username: varchar('username', { length: 100 }).unique(),
  passwordHash: text('password_hash'),
  authProvider: authProviderEnum('auth_provider').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  avatarUrl: text('avatar_url'),
  isCgvAccepted: boolean('is_cgv_accepted').notNull().default(false),
  cgvAcceptedAt: timestamp('cgv_accepted_at', { withTimezone: true }),
  isMarketingOptedIn: boolean('is_marketing_opted_in').notNull().default(false),
  emailVerifyToken: uuid('email_verify_token').unique(),
  emailVerifyTokenExpiresAt: timestamp('email_verify_token_expires_at', { withTimezone: true }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  banReason: text('ban_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export type User = typeof users.$inferSelect
