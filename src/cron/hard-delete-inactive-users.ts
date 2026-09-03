import { db } from '../db/client.js'
import {
  findUsersEligibleForHardDelete,
  hardDeleteUser,
  insertDeletionAudit,
} from '../db/entities/users/users.repository.js'
import type { User } from '../db/entities/users/users.schema.js'
import type { DeletionReason } from '../shared/enums/deletion-reason.js'
import { logger } from '../shared/utils/logger.js'
import { createCronJob } from './create-cron-job.js'
import type { CronJob } from './create-cron-job.js'

let job: CronJob | null = null

export function start(intervalMs: number, graceDays: number): void {
  job = createCronJob({
    name: 'Hard-delete inactive users',
    run: () => runHardDelete(graceDays),
  })
  job.start(intervalMs)
}

export function stop(): void {
  if (job !== null) {
    job.stop()
    job = null
  }
}

async function runHardDelete(graceDays: number): Promise<number> {
  const eligibleUsers = await findUsersEligibleForHardDelete(graceDays)
  let deletedCount = 0

  for (const { user, reason } of eligibleUsers) {
    const succeeded = await processUser(user, reason)
    if (succeeded) deletedCount++
  }

  return deletedCount
}

async function processUser(user: User, reason: DeletionReason): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      await insertDeletionAudit(tx, {
        userId: user.id,
        email: user.email,
        deletedAt: user.deletedAt,
        reason,
      })
      await hardDeleteUser(user.id, tx)
    })
    return true
  } catch (error) {
    logger.error({ error }, 'Failed to hard-delete user')
    return false
  }
}
