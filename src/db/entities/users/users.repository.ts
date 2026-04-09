import { eq } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { users } from './users.schema.js'
import type { User } from './users.schema.js'

export function findUserById(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}

export async function softDeleteUser(userId: string): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()

  return user
}
