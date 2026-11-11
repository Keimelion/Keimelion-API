import { env } from '../../config/env.js'
import { deleteExpiredPendingListInvites } from '../../db/entities/list-invites/list-invites.repository.js'
import { createCronJob } from '../create-cron-job.js'

export const cleanupExpiredListInvites = createCronJob({
  name: 'Expired list invite cleanup',
  intervalMs: env.LIST_INVITE_CLEANUP_INTERVAL_MS,
  run: () => deleteExpiredPendingListInvites(),
})
