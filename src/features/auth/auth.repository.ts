import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import type { DbTransaction } from '../../db/client.js'
import { accessTokens } from '../../db/entities/access-tokens/access-tokens.schema.js'
import { users } from '../../db/entities/users/users.schema.js'
import type { User } from '../../db/entities/users/users.schema.js'
import { refreshTokens } from '../../db/entities/refresh-tokens/refresh-tokens.schema.js'
import { buildActivityFields } from '../../db/entities/users/users.repository.js'

interface RotateRefreshTokenInput {
  previousRefreshTokenId: string
  newAccessTokenId: string
  newAccessTokenExpiresAt: Date
  newRefreshTokenHash: string
  newRefreshTokenExpiresAt: Date
  userId: string
}

export interface SessionTokenRows {
  accessTokenId: string
  accessTokenExpiresAt: Date
  refreshTokenHash: string
  refreshTokenExpiresAt: Date
}

// Returns the user row as updated by the activity tracking (lastActiveAt, userStatus). Pass `tx` to
// open the session in the same transaction as another write (e.g. the account creation).
export async function storeSessionAndUpdateActivity(
  userId: string,
  session: SessionTokenRows,
  tx?: DbTransaction,
): Promise<User | undefined> {
  if (!tx) return db.transaction((transaction) => storeSessionAndUpdateActivity(userId, session, transaction))

  await tx.insert(accessTokens).values({ tokenId: session.accessTokenId, userId, expiresAt: session.accessTokenExpiresAt })
  await tx.insert(refreshTokens).values({ tokenHash: session.refreshTokenHash, userId, expiresAt: session.refreshTokenExpiresAt })
  const [user] = await tx.update(users).set(buildActivityFields()).where(eq(users.id, userId)).returning()
  return user
}

export async function revokeTokenAndUpdateActivity(tokenId: string, userId: string, refreshTokenHash?: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(accessTokens).where(eq(accessTokens.tokenId, tokenId))
    if (refreshTokenHash !== undefined) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, refreshTokenHash), eq(refreshTokens.userId, userId)))
    }
    await tx.update(users).set(buildActivityFields()).where(eq(users.id, userId))
  })
}

export async function rotateRefreshTokenAndIssueAccessToken(input: RotateRefreshTokenInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, input.previousRefreshTokenId))
    await tx.insert(accessTokens).values({
      tokenId: input.newAccessTokenId,
      userId: input.userId,
      expiresAt: input.newAccessTokenExpiresAt,
    })
    await tx.insert(refreshTokens).values({
      tokenHash: input.newRefreshTokenHash,
      userId: input.userId,
      expiresAt: input.newRefreshTokenExpiresAt,
    })
    await tx.update(users).set(buildActivityFields()).where(eq(users.id, input.userId))
  })
}
