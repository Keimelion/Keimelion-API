import { env } from '../config/env.js'
import { deleteExpiredRefreshTokens } from '../db/entities/refresh-tokens/refresh-tokens.repository.js'
import { createCronJob } from './create-cron-job.js'

export const cleanupExpiredRefreshTokens = createCronJob({
  name: 'Expired refresh token cleanup',
  intervalMs: env.REFRESH_TOKEN_CLEANUP_INTERVAL_MS,
  run: deleteExpiredRefreshTokens,
})
