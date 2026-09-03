import { deleteExpiredTokens } from '../db/entities/access-tokens/access-tokens.repository.js'
import { createCronJob } from './create-cron-job.js'

export const { start, stop } = createCronJob({
  name: 'Expired JWT cleanup',
  run: deleteExpiredTokens,
})
