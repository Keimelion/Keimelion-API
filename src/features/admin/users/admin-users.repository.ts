import { db } from '../../../db/client.js'
import { users } from '../../../db/entities/users/users.schema.js'
import { count, eq } from 'drizzle-orm'
import type { User } from '../../../db/entities/users/users.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'

type AdminUpdateUserFields = Partial<Pick<typeof users.$inferInsert, 'avatarUrl' | 'isMarketingOptedIn' | 'role'>>

export async function countAllUsers(): Promise<number> {
  const [row] = await db.select({ count: count() }).from(users)
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

export async function adminUpdateUser(
  id: string,
  input: AdminUpdateUserFields,
): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set(input)
    .where(eq(users.id, id))
    .returning()

  return user
}
