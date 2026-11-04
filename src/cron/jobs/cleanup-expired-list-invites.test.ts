import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../db/entities/list-invites/list-invites.repository.js', () => ({
  deleteExpiredPendingListInvites: vi.fn(),
}))

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { env } from '../../config/env.js'
import { deleteExpiredPendingListInvites } from '../../db/entities/list-invites/list-invites.repository.js'
import { logger } from '../../shared/utils/logger.js'
import { cleanupExpiredListInvites } from './cleanup-expired-list-invites.js'

const INTERVAL_MS = env.LIST_INVITE_CLEANUP_INTERVAL_MS

describe('cleanup-expired-list-invites cron job', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanupExpiredListInvites.stop()
    vi.useRealTimers()
  })

  it('does not run at startup', () => {
    cleanupExpiredListInvites.start()

    expect(vi.mocked(deleteExpiredPendingListInvites)).not.toHaveBeenCalled()
  })

  it('purges every list (no listId filter) after the interval elapses', async () => {
    vi.mocked(deleteExpiredPendingListInvites).mockResolvedValueOnce(3)

    cleanupExpiredListInvites.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredPendingListInvites)).toHaveBeenCalledExactlyOnceWith()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 3 }, 'Expired list invite cleanup completed')
  })

  it('logs the error and keeps running when the purge throws', async () => {
    const error = new Error('DB failure')
    vi.mocked(deleteExpiredPendingListInvites).mockRejectedValueOnce(error)
    vi.mocked(deleteExpiredPendingListInvites).mockResolvedValueOnce(1)

    cleanupExpiredListInvites.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith({ error }, 'Expired list invite cleanup failed')

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteExpiredPendingListInvites)).toHaveBeenCalledTimes(2)
  })

  it('stop cancels scheduled runs', async () => {
    vi.mocked(deleteExpiredPendingListInvites).mockResolvedValue(0)

    cleanupExpiredListInvites.start()
    cleanupExpiredListInvites.stop()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3)

    expect(vi.mocked(deleteExpiredPendingListInvites)).not.toHaveBeenCalled()
  })
})
