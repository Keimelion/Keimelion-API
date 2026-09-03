import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../db/entities/access-tokens/access-tokens.repository.js', () => ({
  deleteExpiredAccessTokens: vi.fn(),
}))

vi.mock('../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { env } from '../config/env.js'
import { deleteExpiredAccessTokens } from '../db/entities/access-tokens/access-tokens.repository.js'
import { logger } from '../shared/utils/logger.js'
import { cleanupExpiredAccessTokens } from './cleanup-expired-access-tokens.js'

const INTERVAL_MS = env.JWT_CLEANUP_INTERVAL_MS

describe('cleanup-expired-access-tokens cron job', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanupExpiredAccessTokens.stop()
    vi.useRealTimers()
  })

  it('does not run at startup', () => {
    cleanupExpiredAccessTokens.start()

    expect(vi.mocked(deleteExpiredAccessTokens)).not.toHaveBeenCalled()
  })

  it('runs after the interval elapses', async () => {
    vi.mocked(deleteExpiredAccessTokens).mockResolvedValueOnce(3)

    cleanupExpiredAccessTokens.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredAccessTokens)).toHaveBeenCalledOnce()
  })

  it('logs the number of deleted rows after each run', async () => {
    vi.mocked(deleteExpiredAccessTokens).mockResolvedValueOnce(5)

    cleanupExpiredAccessTokens.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 5 }, 'Expired JWT cleanup completed')
  })

  it('logs zero deleted rows when no tokens are expired', async () => {
    vi.mocked(deleteExpiredAccessTokens).mockResolvedValueOnce(0)

    cleanupExpiredAccessTokens.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 0 }, 'Expired JWT cleanup completed')
  })

  it('logs the error and continues when deleteExpiredAccessTokens throws', async () => {
    const error = new Error('DB failure')
    vi.mocked(deleteExpiredAccessTokens).mockRejectedValueOnce(error)
    vi.mocked(deleteExpiredAccessTokens).mockResolvedValueOnce(2)

    cleanupExpiredAccessTokens.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith({ error }, 'Expired JWT cleanup failed')
    expect(vi.mocked(logger.info)).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredAccessTokens)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 2 }, 'Expired JWT cleanup completed')
  })

  it('overlap guard prevents concurrent runs', async () => {
    let resolveFirst!: (value: number) => void
    const firstRunPromise = new Promise<number>((resolve) => {
      resolveFirst = resolve
    })
    vi.mocked(deleteExpiredAccessTokens).mockReturnValueOnce(firstRunPromise)

    cleanupExpiredAccessTokens.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredAccessTokens)).toHaveBeenCalledOnce()

    resolveFirst(1)
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(deleteExpiredAccessTokens)).toHaveBeenCalledTimes(2)
  })

  it('stop cancels scheduled runs', async () => {
    vi.mocked(deleteExpiredAccessTokens).mockResolvedValue(0)

    cleanupExpiredAccessTokens.start()
    cleanupExpiredAccessTokens.stop()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3)

    expect(vi.mocked(deleteExpiredAccessTokens)).not.toHaveBeenCalled()
  })
})
