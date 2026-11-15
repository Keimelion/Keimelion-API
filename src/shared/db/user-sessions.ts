import type { DbTransaction } from '../../db/client.js'
import { deleteAllUserTokens } from '../../db/entities/access-tokens/access-tokens.repository.js'
import { deleteAllUserRefreshTokens } from '../../db/entities/refresh-tokens/refresh-tokens.repository.js'


export async function revokeAllUserSessions(userId: string, tx?: DbTransaction): Promise<void> {
  await deleteAllUserTokens(userId, tx)
  await deleteAllUserRefreshTokens(userId, tx)
}
