import type { db } from '../../client.js'
import { deleteAllUserTokens } from '../access-tokens/access-tokens.repository.js'
import { deleteAllUserRefreshTokens } from '../refresh-tokens/refresh-tokens.repository.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function revokeAllUserSessions(userId: string, tx?: DbTransaction): Promise<void> {
  await deleteAllUserTokens(userId, tx)
  await deleteAllUserRefreshTokens(userId, tx)
}
