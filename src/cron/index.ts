import { env } from '../config/env.js'
import { start as startCleanupExpiredTokens, stop as stopCleanupExpiredTokens } from './cleanup-expired-tokens.js'

export function startCronJobs(): void {
  startCleanupExpiredTokens(env.JWT_CLEANUP_INTERVAL_MS)
}

export function stopCronJobs(): void {
  stopCleanupExpiredTokens()
}
