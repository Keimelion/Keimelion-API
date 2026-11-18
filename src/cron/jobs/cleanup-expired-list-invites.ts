import { env } from '../../config/env.js'
import {
  deleteExpiredPendingListInvites,
  deleteResolvedListInvitesOlderThan,
} from '../../db/entities/list-invites/list-invites.repository.js'
import { ONE_DAY_MS } from '../../shared/utils/time.js'
import { createCronJob } from '../create-cron-job.js'

// GDPR data minimisation: a declined or revoked invite keeps the invitee's email for 30 days
// after its resolution, then the row is deleted. Accepted rows live as long as the membership
// (deleted on remove / leave).
const RESOLVED_INVITE_RETENTION_DAYS = 30

async function runListInviteCleanup(): Promise<number> {
  const now = new Date()
  const expiredPendingCount = await deleteExpiredPendingListInvites({ now })
  const resolvedCount = await deleteResolvedListInvitesOlderThan(
    new Date(now.getTime() - RESOLVED_INVITE_RETENTION_DAYS * ONE_DAY_MS),
  )
  return expiredPendingCount + resolvedCount
}

export const cleanupExpiredListInvites = createCronJob({
  name: 'Expired list invite cleanup',
  intervalMs: env.LIST_INVITE_CLEANUP_INTERVAL_MS,
  run: runListInviteCleanup,
})
