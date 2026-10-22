import { env } from '../config/env.js'
import type { CronJob } from './create-cron-job.js'
import { cleanupExpiredAccessTokens } from './jobs/cleanup-expired-access-tokens.js'
import { cleanupExpiredRefreshTokens } from './jobs/cleanup-expired-refresh-tokens.js'
import { fxRatesRefresh } from './jobs/fx-rates-refresh.js'
import { hardDeleteInactiveUsers } from './jobs/hard-delete-inactive-users.js'

const jobs: CronJob[] = [
  cleanupExpiredAccessTokens,
  cleanupExpiredRefreshTokens,
  hardDeleteInactiveUsers,
  ...(env.FX_REFRESH_ENABLED ? [fxRatesRefresh] : []),
]

export function startCronJobs(): void {
  for (const job of jobs) job.start()
}

export function stopCronJobs(): void {
  for (const job of jobs) job.stop()
}
