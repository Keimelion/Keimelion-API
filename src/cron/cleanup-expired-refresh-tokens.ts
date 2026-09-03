import { deleteExpiredRefreshTokens } from '../db/entities/refresh-tokens/refresh-tokens.repository.js'
import { createCronJob } from './create-cron-job.js'

export const { start, stop } = createCronJob({
  name: 'Expired refresh token cleanup',
  run: deleteExpiredRefreshTokens,
})
