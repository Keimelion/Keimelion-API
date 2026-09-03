import { cleanupExpiredAccessTokens } from './cleanup-expired-access-tokens.js'
import { cleanupExpiredRefreshTokens } from './cleanup-expired-refresh-tokens.js'
import { hardDeleteInactiveUsers } from './hard-delete-inactive-users.js'

const jobs = [cleanupExpiredAccessTokens, cleanupExpiredRefreshTokens, hardDeleteInactiveUsers]

export function startCronJobs(): void {
  for (const job of jobs) job.start()
}

export function stopCronJobs(): void {
  for (const job of jobs) job.stop()
}
