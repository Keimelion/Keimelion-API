import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { tokenBlacklist } from './token-blacklist.schema.js'

export interface InsertTokenBlacklistInput {
  jti: string
  expiresAt: Date
}

export async function insertTokenBlacklist(input: InsertTokenBlacklistInput): Promise<void> {
  await db.insert(tokenBlacklist).values({ jti: input.jti, expiresAt: input.expiresAt })
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const entry = await db.query.tokenBlacklist.findFirst({ where: eq(tokenBlacklist.jti, jti) })
  return entry !== undefined
}
