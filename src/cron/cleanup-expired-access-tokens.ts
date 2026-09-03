import { env } from '../config/env.js'
import { deleteExpiredAccessTokens } from '../db/entities/access-tokens/access-tokens.repository.js'
import { createCronJob } from './create-cron-job.js'

export const cleanupExpiredAccessTokens = createCronJob({
  name: 'Expired JWT cleanup',
  intervalMs: env.JWT_CLEANUP_INTERVAL_MS,
  run: deleteExpiredAccessTokens,
})
