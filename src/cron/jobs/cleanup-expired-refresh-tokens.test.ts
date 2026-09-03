import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../db/entities/refresh-tokens/refresh-tokens.repository.js', () => ({
  deleteExpiredRefreshTokens: vi.fn(),
}))

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { env } from '../../config/env.js'
import { deleteExpiredRefreshTokens } from '../../db/entities/refresh-tokens/refresh-tokens.repository.js'
import { logger } from '../../shared/utils/logger.js'
import { cleanupExpiredRefreshTokens } from './cleanup-expired-refresh-tokens.js'

const INTERVAL_MS = env.REFRESH_TOKEN_CLEANUP_INTERVAL_MS

describe('cleanup-expired-refresh-tokens cron job', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanupExpiredRefreshTokens.stop()
    vi.useRealTimers()
  })

  it('does not run at startup', () => {
    cleanupExpiredRefreshTokens.start()

    expect(vi.mocked(deleteExpiredRefreshTokens)).not.toHaveBeenCalled()
  })

  it('runs after the interval elapses', async () => {
    vi.mocked(deleteExpiredRefreshTokens).mockResolvedValueOnce(3)

    cleanupExpiredRefreshTokens.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredRefreshTokens)).toHaveBeenCalledOnce()
  })

  it('logs the number of deleted rows after each run', async () => {
    vi.mocked(deleteExpiredRefreshTokens).mockResolvedValueOnce(5)

    cleanupExpiredRefreshTokens.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 5 }, 'Expired refresh token cleanup completed')
  })

  it('logs zero deleted rows when no tokens are expired', async () => {
    vi.mocked(deleteExpiredRefreshTokens).mockResolvedValueOnce(0)

    cleanupExpiredRefreshTokens.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 0 }, 'Expired refresh token cleanup completed')
  })

  it('logs the error and continues when deleteExpiredRefreshTokens throws', async () => {
    const error = new Error('DB failure')
    vi.mocked(deleteExpiredRefreshTokens).mockRejectedValueOnce(error)
    vi.mocked(deleteExpiredRefreshTokens).mockResolvedValueOnce(2)

    cleanupExpiredRefreshTokens.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith({ error }, 'Expired refresh token cleanup failed')
    expect(vi.mocked(logger.info)).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredRefreshTokens)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 2 }, 'Expired refresh token cleanup completed')
  })

  it('overlap guard prevents concurrent runs', async () => {
    let resolveFirst!: (value: number) => void
    const firstRunPromise = new Promise<number>((resolve) => {
      resolveFirst = resolve
    })
    vi.mocked(deleteExpiredRefreshTokens).mockReturnValueOnce(firstRunPromise)

    cleanupExpiredRefreshTokens.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredRefreshTokens)).toHaveBeenCalledOnce()

    resolveFirst(1)
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(deleteExpiredRefreshTokens)).toHaveBeenCalledTimes(2)
  })

  it('stop cancels scheduled runs', async () => {
    vi.mocked(deleteExpiredRefreshTokens).mockResolvedValue(0)

    cleanupExpiredRefreshTokens.start()
    cleanupExpiredRefreshTokens.stop()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3)

    expect(vi.mocked(deleteExpiredRefreshTokens)).not.toHaveBeenCalled()
  })
})
