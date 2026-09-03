import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { refreshTokens } from './refresh-tokens.schema.js'
import type { RefreshToken } from './refresh-tokens.schema.js'

export async function insertRefreshToken(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
  await db.insert(refreshTokens).values({ tokenHash, userId, expiresAt })
}

export function findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined> {
  return db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, tokenHash) })
}
