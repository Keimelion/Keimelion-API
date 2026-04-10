import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { tokenBlacklist } from '../../db/entities/token-blacklist/token-blacklist.schema.js'
import { users } from '../../db/entities/users/users.schema.js'

export interface BlacklistTokenInput {
  jti: string
  expiresAt: Date
  userId: string
}

export async function blacklistTokenAndUpdateActivity(input: BlacklistTokenInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(tokenBlacklist).values({ jti: input.jti, expiresAt: input.expiresAt })
    await tx.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, input.userId))
  })
}
