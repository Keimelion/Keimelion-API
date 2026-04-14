import { env } from '../config/env.js'
import { start as startCleanupExpiredTokens, stop as stopCleanupExpiredTokens } from './cleanup-expired-tokens.js'
import {
  start as startHardDeleteInactiveUsers,
  stop as stopHardDeleteInactiveUsers,
} from './hard-delete-inactive-users.js'

export function startCronJobs(): void {
  startCleanupExpiredTokens(env.JWT_CLEANUP_INTERVAL_MS)
  startHardDeleteInactiveUsers(env.USER_HARD_DELETE_INTERVAL_MS, env.USER_HARD_DELETE_GRACE_DAYS)
}

export function stopCronJobs(): void {
  stopCleanupExpiredTokens()
  stopHardDeleteInactiveUsers()
}
