import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { users } from './users.schema.js'
import type { User } from './users.schema.js'
import { userDeletionAudit } from '../user-deletion-audit/user-deletion-audit.schema.js'
import type { DeletionReason } from '../../../shared/enums/deletion-reason.js'

const HARD_DELETE_BATCH_SIZE = 100

interface EligibleUser {
  user: User
  reason: DeletionReason
}

interface InsertDeletionAuditInput {
  userId: string
  email: string
  deletedAt: Date | null
  reason: DeletionReason
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export function findUserById(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}

export async function anonymizeUser(tx: DbTransaction, userId: string, anonymizedEmail: string): Promise<User | undefined> {
  const [user] = await tx
    .update(users)
    .set({ email: anonymizedEmail, username: null, avatarUrl: null, passwordHash: null, deletedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()
  return user
}

export async function softDeleteUser(userId: string): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()

  return user
}

export async function findUsersEligibleForHardDelete(graceDays: number): Promise<EligibleUser[]> {
  const softDeleted = await db
    .select()
    .from(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        sql`${users.deletedAt} < now() - make_interval(days => ${graceDays})`,
      ),
    )
    .limit(HARD_DELETE_BATCH_SIZE)

  const inactive = await db
    .select()
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        sql`COALESCE(${users.lastActiveAt}, ${users.createdAt}) < now() - interval '24 months'`,
      ),
    )
    .limit(HARD_DELETE_BATCH_SIZE)

  const softDeletedEntries: EligibleUser[] = softDeleted.map((user) => ({
    user,
    reason: 'soft_delete_grace',
  }))

  const inactiveEntries: EligibleUser[] = inactive.map((user) => ({
    user,
    reason: 'inactive_24mo',
  }))

  return [...softDeletedEntries, ...inactiveEntries]
}

export async function hardDeleteUser(userId: string, tx: DbTransaction): Promise<void> {
  await tx.delete(users).where(eq(users.id, userId))
}

export async function insertDeletionAudit(
  tx: DbTransaction,
  input: InsertDeletionAuditInput,
): Promise<void> {
  await tx.insert(userDeletionAudit).values({
    userId: input.userId,
    email: input.email,
    deletedAt: input.deletedAt,
    reason: input.reason,
  })
}

export async function updateLastActiveAt(userId: string): Promise<void> {
  await db.execute(
    sql`UPDATE users SET last_active_at = now() WHERE id = ${userId} AND (last_active_at IS NULL OR last_active_at < now() - interval '1 hour')`,
  )
}

export async function updatePasswordHash(userId: string, hash: string, tx?: DbTransaction): Promise<void> {
  const client = tx ?? db
  await client.update(users).set({ passwordHash: hash }).where(eq(users.id, userId))
}
