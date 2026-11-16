import { env } from '../../config/env.js'
import {
  deleteExpiredUnconfirmedWaitlistEntries,
  deleteWaitlistEntriesLaunchEmailedBefore,
} from '../../db/entities/waitlist/waitlist.repository.js'
import { subtractMonths } from '../../shared/utils/time.js'
import { createCronJob } from '../create-cron-job.js'

// Compliance: the privacy policy promises deletion 12 months after the launch email.
const LAUNCH_EMAIL_RETENTION_MONTHS = 12

// Unconfirmed entries are purged as soon as their confirmation link lapses, after
// WAITLIST_CONFIRMATION_VALIDITY_DAYS (the window the confirmation email announces).
async function runWaitlistPurge(): Promise<number> {
  const now = new Date()
  const unconfirmedCount = await deleteExpiredUnconfirmedWaitlistEntries(now)
  const launchEmailedCount = await deleteWaitlistEntriesLaunchEmailedBefore(
    subtractMonths(now, LAUNCH_EMAIL_RETENTION_MONTHS),
  )
  return unconfirmedCount + launchEmailedCount
}

export const purgeWaitlistEntries = createCronJob({
  name: 'Waitlist entries purge',
  intervalMs: env.WAITLIST_PURGE_INTERVAL_MS,
  run: runWaitlistPurge,
})
