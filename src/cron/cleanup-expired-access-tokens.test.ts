import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../db/entities/access-tokens/access-tokens.repository.js', () => ({
  deleteExpiredTokens: vi.fn(),
}))

vi.mock('../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { deleteExpiredTokens } from '../db/entities/access-tokens/access-tokens.repository.js'
import { logger } from '../shared/utils/logger.js'
import { start, stop } from './cleanup-expired-access-tokens.js'

const INTERVAL_MS = 60_000

describe('cleanup-expired-access-tokens cron job', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    stop()
    vi.useRealTimers()
  })

  it('does not run at startup', () => {
    start(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredTokens)).not.toHaveBeenCalled()
  })

  it('runs after the interval elapses', async () => {
    vi.mocked(deleteExpiredTokens).mockResolvedValueOnce(3)

    start(INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredTokens)).toHaveBeenCalledOnce()
  })

  it('logs the number of deleted rows after each run', async () => {
    vi.mocked(deleteExpiredTokens).mockResolvedValueOnce(5)

    start(INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 5 }, 'Expired JWT cleanup completed')
  })

  it('logs zero deleted rows when no tokens are expired', async () => {
    vi.mocked(deleteExpiredTokens).mockResolvedValueOnce(0)

    start(INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 0 }, 'Expired JWT cleanup completed')
  })

  it('logs the error and continues when deleteExpiredTokens throws', async () => {
    const error = new Error('DB failure')
    vi.mocked(deleteExpiredTokens).mockRejectedValueOnce(error)
    vi.mocked(deleteExpiredTokens).mockResolvedValueOnce(2)

    start(INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith({ error }, 'Expired JWT cleanup failed')
    expect(vi.mocked(logger.info)).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredTokens)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 2 }, 'Expired JWT cleanup completed')
  })

  it('overlap guard prevents concurrent runs', async () => {
    let resolveFirst!: (value: number) => void
    const firstRunPromise = new Promise<number>((resolve) => {
      resolveFirst = resolve
    })
    vi.mocked(deleteExpiredTokens).mockReturnValueOnce(firstRunPromise)

    start(INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredTokens)).toHaveBeenCalledOnce()

    resolveFirst(1)
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(deleteExpiredTokens)).toHaveBeenCalledTimes(2)
  })

  it('stop cancels scheduled runs', async () => {
    vi.mocked(deleteExpiredTokens).mockResolvedValue(0)

    start(INTERVAL_MS)
    stop()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3)

    expect(vi.mocked(deleteExpiredTokens)).not.toHaveBeenCalled()
  })
})
