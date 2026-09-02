import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { activeTokens } from '../../db/entities/active-tokens/active-tokens.schema.js'
import { users } from '../../db/entities/users/users.schema.js'
import { refreshTokens } from '../../db/entities/refresh-tokens/refresh-tokens.schema.js'

interface RotateRefreshTokenInput {
  previousRefreshTokenId: string
  newAccessTokenJti: string
  newAccessTokenExpiresAt: Date
  newRefreshTokenHash: string
  newRefreshTokenExpiresAt: Date
  userId: string
}

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

export async function rotateRefreshTokenAndIssueAccessToken(input: RotateRefreshTokenInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, input.previousRefreshTokenId))
    await tx.insert(activeTokens).values({
      jti: input.newAccessTokenJti,
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
