import { env } from '../config/env.js'
import type { CronJob } from './create-cron-job.js'
import { cleanupExpiredAccessTokens } from './jobs/cleanup-expired-access-tokens.js'
import { cleanupExpiredRefreshTokens } from './jobs/cleanup-expired-refresh-tokens.js'
import { cleanupExpiredListInvites } from './jobs/cleanup-expired-list-invites.js'
import { cleanupOrphanImages } from './jobs/cleanup-orphan-images.js'
import { fxRatesRefresh } from './jobs/fx-rates-refresh.js'
import { hardDeleteInactiveUsers } from './jobs/hard-delete-inactive-users.js'
import { purgeWaitlistEntries } from './jobs/purge-waitlist-entries.js'

const jobs: CronJob[] = [
  cleanupExpiredAccessTokens,
  cleanupExpiredRefreshTokens,
  cleanupExpiredListInvites,
  hardDeleteInactiveUsers,
  cleanupOrphanImages,
  purgeWaitlistEntries,
  ...(env.FX_REFRESH_ENABLED ? [fxRatesRefresh] : []),
]

export function startCronJobs(): void {
  for (const job of jobs) job.start()
}

export function stopCronJobs(): void {
  for (const job of jobs) job.stop()
}
