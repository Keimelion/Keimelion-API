import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { activeTokens } from './active-tokens.schema.js'

export async function isTokenActive(jti: string): Promise<boolean> {
  const entry = await db.query.activeTokens.findFirst({ where: eq(activeTokens.jti, jti) })
  return entry !== undefined
}
