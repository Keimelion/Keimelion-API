import { logger } from '../shared/utils/logger.js'

export interface CronJob {
  start: (intervalMs: number) => void
  stop: () => void
}

export interface CronJobOptions {
  name: string
  run: () => Promise<number>
}

export function createCronJob({ name, run }: CronJobOptions): CronJob {
  let intervalId: ReturnType<typeof setInterval> | null = null
  let isRunning = false

  const tick = async (): Promise<void> => {
    if (isRunning) return

    isRunning = true
    try {
      const deletedCount = await run()
      logger.info({ deletedCount }, `${name} completed`)
    } catch (error) {
      logger.error({ error }, `${name} failed`)
    } finally {
      isRunning = false
    }
  }

  return {
    start: (intervalMs) => {
      intervalId = setInterval(() => {
        void tick()
      }, intervalMs)
    },
    stop: () => {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    },
  }
}
