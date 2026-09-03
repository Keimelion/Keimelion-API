import { deleteExpiredRefreshTokens } from '../db/entities/refresh-tokens/refresh-tokens.repository.js'
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
    const deletedCount = await deleteExpiredRefreshTokens()
    logger.info({ deletedCount }, 'Expired refresh token cleanup completed')
  } catch (error) {
    logger.error({ error }, 'Expired refresh token cleanup failed')
  } finally {
    isRunning = false
  }
}
