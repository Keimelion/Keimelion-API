import { cleanupExpiredAccessTokens } from './jobs/cleanup-expired-access-tokens.js'
import { cleanupExpiredRefreshTokens } from './jobs/cleanup-expired-refresh-tokens.js'
import { hardDeleteInactiveUsers } from './jobs/hard-delete-inactive-users.js'

const jobs = [cleanupExpiredAccessTokens, cleanupExpiredRefreshTokens, hardDeleteInactiveUsers]

export function startCronJobs(): void {
  for (const job of jobs) job.start()
}

export function stopCronJobs(): void {
  for (const job of jobs) job.stop()
}
