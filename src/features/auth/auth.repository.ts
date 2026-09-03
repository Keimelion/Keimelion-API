import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { accessTokens } from '../../db/entities/access-tokens/access-tokens.schema.js'
import { users } from '../../db/entities/users/users.schema.js'
import { refreshTokens } from '../../db/entities/refresh-tokens/refresh-tokens.schema.js'

interface RotateRefreshTokenInput {
  previousRefreshTokenId: string
  newAccessTokenId: string
  newAccessTokenExpiresAt: Date
  newRefreshTokenHash: string
  newRefreshTokenExpiresAt: Date
  userId: string
}

export async function storeTokenAndUpdateActivity(tokenId: string, userId: string, expiresAt: Date): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(accessTokens).values({ tokenId, userId, expiresAt })
    await tx.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId))
  })
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
    await tx.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId))
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
    await tx.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, input.userId))
  })
}
