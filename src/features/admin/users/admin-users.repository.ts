import { db } from '../../../db/client.js'
import { users } from '../../../db/entities/users/users.schema.js'
import { eq, sql } from 'drizzle-orm'
import type { User } from '../../../db/entities/users/users.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { AdminUpdateUserInput } from './endpoints/update-user.js'

export { findUserById, softDeleteUser } from '../../../db/entities/users/users.repository.js'

export async function countAllUsers(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
  return row?.count ?? 0
}

export async function findAllUsers(input: PaginationInput): Promise<User[]> {
  const offset = (input.page - 1) * input.limit
  return db.query.users.findMany({
    limit: input.limit,
    offset,
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  })
}

export async function adminUpdateUser(id: string, input: AdminUpdateUserInput): Promise<User | undefined> {
  const values: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }

  if (input.avatarUrl !== undefined) values.avatarUrl = input.avatarUrl ?? null
  if (input.isMarketingOptedIn !== undefined) values.isMarketingOptedIn = input.isMarketingOptedIn
  if (input.role !== undefined) values.role = input.role

  const [user] = await db.update(users).set(values).where(eq(users.id, id)).returning()

  return user
}
