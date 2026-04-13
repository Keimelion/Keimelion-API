import { db } from '../db/client.js'
import {
  findUsersEligibleForHardDelete,
  hardDeleteUser,
  insertDeletionAudit,
} from '../db/entities/users/users.repository.js'
import type { User } from '../db/entities/users/users.schema.js'
import type { DeletionReason } from '../shared/enums/deletion-reason.js'
import { logger } from '../shared/utils/logger.js'

let intervalId: ReturnType<typeof setInterval> | null = null
let isRunning = false

export function start(intervalMs: number, graceDays: number): void {
  intervalId = setInterval(() => {
    void runHardDelete(graceDays)
  }, intervalMs)
}

export function stop(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

async function runHardDelete(graceDays: number): Promise<void> {
  if (isRunning) return

  isRunning = true
  try {
    const eligibleUsers = await findUsersEligibleForHardDelete(graceDays)
    let deletedCount = 0

    for (const { user, reason } of eligibleUsers) {
      const succeeded = await processUser(user, reason)
      if (succeeded) deletedCount++
    }

    logger.info({ deletedCount }, 'Hard-delete inactive users completed')
  } catch (error) {
    logger.error({ error }, 'Hard-delete inactive users failed')
  } finally {
    isRunning = false
  }
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
