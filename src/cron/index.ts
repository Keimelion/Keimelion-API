import { env } from '../config/env.js'
import { start as startCleanupExpiredAccessTokens, stop as stopCleanupExpiredAccessTokens } from './cleanup-expired-access-tokens.js'
import {
  start as startCleanupExpiredRefreshTokens,
  stop as stopCleanupExpiredRefreshTokens,
} from './cleanup-expired-refresh-tokens.js'
import {
  start as startHardDeleteInactiveUsers,
  stop as stopHardDeleteInactiveUsers,
} from './hard-delete-inactive-users.js'

export function startCronJobs(): void {
  startCleanupExpiredAccessTokens(env.JWT_CLEANUP_INTERVAL_MS)
  startCleanupExpiredRefreshTokens(env.REFRESH_TOKEN_CLEANUP_INTERVAL_MS)
  startHardDeleteInactiveUsers(env.USER_HARD_DELETE_INTERVAL_MS, env.USER_HARD_DELETE_GRACE_DAYS)
}

export function stopCronJobs(): void {
  stopCleanupExpiredAccessTokens()
  stopCleanupExpiredRefreshTokens()
  stopHardDeleteInactiveUsers()
}
