import { eq, lt } from 'drizzle-orm'
import { db } from '../../client.js'
import { accessTokens } from './access-tokens.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function isTokenActive(tokenId: string): Promise<boolean> {
  const entry = await db.query.accessTokens.findFirst({ where: eq(accessTokens.tokenId, tokenId) })
  return entry !== undefined
}

export async function deleteExpiredTokens(): Promise<number> {
  const deleted = await db
    .delete(accessTokens)
    .where(lt(accessTokens.expiresAt, new Date()))
    .returning({ tokenId: accessTokens.tokenId })
  return deleted.length
}

export async function deleteAllUserTokens(userId: string, tx?: DbTransaction): Promise<void> {
  const client = tx ?? db
  await client.delete(accessTokens).where(eq(accessTokens.userId, userId))
}
