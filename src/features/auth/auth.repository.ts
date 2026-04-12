import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { activeTokens } from '../../db/entities/active-tokens/active-tokens.schema.js'
import { users } from '../../db/entities/users/users.schema.js'

export async function storeTokenAndUpdateActivity(jti: string, userId: string, expiresAt: Date): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(activeTokens).values({ jti, userId, expiresAt })
    await tx.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId))
  })
}

export async function revokeTokenAndUpdateActivity(jti: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(activeTokens).where(eq(activeTokens.jti, jti))
    await tx.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId))
  })
}
