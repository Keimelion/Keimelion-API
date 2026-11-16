import type { DbTransaction } from '../../client.js'
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { users } from './users.schema.js'
import type { User } from './users.schema.js'
import { userDeletionAudit } from '../user-deletion-audit/user-deletion-audit.schema.js'
import { UserStatuses } from '@keimelion/sdk/enums'
import type { DeletionReason, UserStatus } from '@keimelion/sdk/enums'
import type { UserRowWithAvatar } from '../../../shared/types/user.js'
import { buildStatusAfterActivity } from './users.status.js'

const HARD_DELETE_BATCH_SIZE = 100

// deletedAt ranks first in the status precedence: a soft delete needs no other field to set it
const SOFT_DELETED_STATUS = UserStatuses.PENDING_DELETION

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


export function findUserById(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}

export function findUserByIdWithAvatar(id: string): Promise<UserRowWithAvatar | undefined> {
  return db.query.users.findFirst({
    where: eq(users.id, id),
    with: { avatarImage: true },
  })
}

export function findUserByUsername(username: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.username, username) })
}

export async function anonymizeUser(tx: DbTransaction, userId: string, anonymizedEmail: string): Promise<User | undefined> {
  const [user] = await tx
    .update(users)
    .set({
      email: anonymizedEmail,
      username: null,
      avatarImageId: null,
      passwordHash: null,
      deletedAt: new Date(),
      userStatus: SOFT_DELETED_STATUS,
    })
    .where(eq(users.id, userId))
    .returning()
  return user
}

export async function softDeleteUser(userId: string): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ deletedAt: new Date(), userStatus: SOFT_DELETED_STATUS })
    .where(eq(users.id, userId))
    .returning()

  return user
}

export async function findUsersEligibleForHardDelete(graceDays: number): Promise<EligibleUser[]> {
  const softDeleted = await db.query.users.findMany({
    where: and(
      isNotNull(users.deletedAt),
      sql`${users.deletedAt} < now() - make_interval(days => ${graceDays})`,
    ),
    limit: HARD_DELETE_BATCH_SIZE,
  })

  const inactive = await db.query.users.findMany({
    where: and(
      isNull(users.deletedAt),
      sql`COALESCE(${users.lastActiveAt}, ${users.createdAt}) < now() - interval '24 months'`,
    ),
    limit: HARD_DELETE_BATCH_SIZE,
  })

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
    sql`UPDATE users SET last_active_at = now(), user_status = ${buildStatusAfterActivity()} WHERE id = ${userId} AND (last_active_at IS NULL OR last_active_at < now() - interval '1 hour')`,
  )
}

export function buildActivityFields(): { lastActiveAt: Date; userStatus: SQL<UserStatus> } {
  return { lastActiveAt: new Date(), userStatus: buildStatusAfterActivity() }
}

export async function markInactiveUsers(inactiveBefore: Date): Promise<number> {
  const updated = await db
    .update(users)
    .set({ userStatus: UserStatuses.INACTIVE })
    .where(
      and(
        eq(users.userStatus, UserStatuses.ACTIVE),
        sql`COALESCE(${users.lastActiveAt}, ${users.createdAt}) < ${inactiveBefore.toISOString()}::timestamptz`,
      ),
    )
    .returning({ id: users.id })
  return updated.length
}

export async function updatePasswordHash(userId: string, hash: string, tx?: DbTransaction): Promise<void> {
  const client = tx ?? db
  await client.update(users).set({ passwordHash: hash }).where(eq(users.id, userId))
}
