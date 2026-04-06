import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users } from '../../db/entities/users/users.schema.js'
import { env } from '../../config/env.js'
import { hashPassword } from '../../shared/utils/hash.js'
import type { User } from '../../db/entities/users/users.schema.js'
import type { RegisterInput } from '../auth/endpoints/register.js'
import type { UpdateProfileInput } from './endpoints/update-profile.js'

export function findUserByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email) })
}

export function findUserById(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}

export function findUserByEmailVerifyToken(token: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.emailVerifyToken, token) })
}

export async function insertUser(input: RegisterInput, emailVerifyToken: string): Promise<User | undefined> {
  const passwordHash = await hashPassword(input.password)
  const emailVerifyTokenExpiresAt = new Date(Date.now() + env.EMAIL_VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000)

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      passwordHash,
      authProvider: 'email',
      isCgvAccepted: true,
      cgvAcceptedAt: new Date(),
      isMarketingOptedIn: input.isMarketingOptedIn,
      emailVerifyToken,
      emailVerifyTokenExpiresAt,
    })
    .returning()

  return user
}

export async function markEmailAsVerified(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), emailVerifyToken: null, emailVerifyTokenExpiresAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

export async function updateLastActiveAt(userId: string): Promise<void> {
  await db.update(users).set({ lastActiveAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId))
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput): Promise<User | undefined> {
  const values: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }

  if (input.username !== undefined) values.username = input.username ?? null
  if (input.avatarUrl !== undefined) values.avatarUrl = input.avatarUrl ?? null
  if (input.isMarketingOptedIn !== undefined) values.isMarketingOptedIn = input.isMarketingOptedIn

  const [user] = await db.update(users).set(values).where(eq(users.id, userId)).returning()

  return user
}

export async function softDeleteUser(userId: string): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()

  return user
}
