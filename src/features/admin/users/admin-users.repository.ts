import { db } from '../../../db/client.js'
import { users } from '../../../db/entities/users/users.schema.js'
import { eq, sql } from 'drizzle-orm'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import type { User } from '../../../db/entities/users/users.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { AdminUpdateUserInput } from './endpoints/update-user.js'

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
  const [user] = await db
    .update(users)
    .set(pickDefined(input) as Partial<typeof users.$inferInsert>)
    .where(eq(users.id, id))
    .returning()

  return user
}
