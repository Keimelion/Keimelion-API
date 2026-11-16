import { env } from '../../config/env.js'
import { markInactiveUsers } from '../../db/entities/users/users.repository.js'
import { computeInactivityThreshold } from '../../db/entities/users/users.status.js'
import { createCronJob } from '../create-cron-job.js'

// Time is the only input of users.user_status that changes without a write: an active account
// with no activity for USER_INACTIVITY_THRESHOLD_MONTHS is moved to inactive here.
function runMarkInactiveUsers(): Promise<number> {
  return markInactiveUsers(computeInactivityThreshold(new Date()))
}

export const markInactiveUsersJob = createCronJob({
  name: 'Mark inactive users',
  intervalMs: env.USER_INACTIVITY_STATUS_INTERVAL_MS,
  run: runMarkInactiveUsers,
})
