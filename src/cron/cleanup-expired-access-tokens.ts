import { deleteExpiredTokens } from '../db/entities/access-tokens/access-tokens.repository.js'
import { logger } from '../shared/utils/logger.js'

let intervalId: ReturnType<typeof setInterval> | null = null
let isRunning = false

export function start(intervalMs: number): void {
  intervalId = setInterval(() => {
    void runCleanup()
  }, intervalMs)
}

export function stop(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

async function runCleanup(): Promise<void> {
  if (isRunning) return

  isRunning = true
  try {
    const deletedCount = await deleteExpiredTokens()
    logger.info({ deletedCount }, 'Expired JWT cleanup completed')
  } catch (error) {
    logger.error({ error }, 'Expired JWT cleanup failed')
  } finally {
    isRunning = false
  }
}
