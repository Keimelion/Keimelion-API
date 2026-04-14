import { eq, lt } from 'drizzle-orm'
import { db } from '../../client.js'
import { activeTokens } from './active-tokens.schema.js'

export async function isTokenActive(jti: string): Promise<boolean> {
  const entry = await db.query.activeTokens.findFirst({ where: eq(activeTokens.jti, jti) })
  return entry !== undefined
}

export async function deleteExpiredTokens(): Promise<number> {
  const deleted = await db
    .delete(activeTokens)
    .where(lt(activeTokens.expiresAt, new Date()))
    .returning({ jti: activeTokens.jti })
  return deleted.length
}

export async function deleteAllUserTokens(userId: string): Promise<void> {
  await db.delete(activeTokens).where(eq(activeTokens.userId, userId))
}
