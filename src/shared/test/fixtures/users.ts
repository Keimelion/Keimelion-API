import type { User } from '../../../db/entities/users/users.schema.js'
import { SupportedCurrencies } from '../../enums/currency.js'

/**
 * Canonical admin user row used across admin feature tests.
 *
 * Typed as `User` so TypeScript surfaces any new `users` column at compile
 * time, forcing a single update point when the schema evolves.
 *
 * Per-test variants (NON_ADMIN_USER, TARGET_USER, …) should be built via
 * `makeAdminUser({ id: ..., role: 'user' })` to inherit every field.
 */
export const ADMIN_USER_FIXTURE: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@example.com',
  username: 'adminuser',
  passwordHash: 'hashed',
  authProvider: 'email',
  role: 'admin',
  avatarUrl: null,
  avatarImageId: null,
  isCgvAccepted: true,
  cgvAcceptedAt: new Date('2024-01-01'),
  isMarketingOptedIn: false,
  defaultCurrencyCode: SupportedCurrencies.EUR,
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  emailVerifiedAt: new Date('2024-01-02'),
  passwordResetToken: null,
  passwordResetTokenExpiresAt: null,
  lastActiveAt: null,
  deletedAt: null,
  bannedAt: null,
  banReason: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

export function makeAdminUser(overrides: Partial<User> = {}): User {
  return { ...ADMIN_USER_FIXTURE, ...overrides }
}
