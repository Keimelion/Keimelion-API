import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../db/entities/list-invites/list-invites.repository.js', () => ({
  deleteExpiredPendingListInvites: vi.fn(),
  deleteResolvedListInvitesOlderThan: vi.fn(),
}))

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { env } from '../../config/env.js'
import {
  deleteExpiredPendingListInvites,
  deleteResolvedListInvitesOlderThan,
} from '../../db/entities/list-invites/list-invites.repository.js'
import { logger } from '../../shared/utils/logger.js'
import { cleanupExpiredListInvites } from './cleanup-expired-list-invites.js'

const INTERVAL_MS = env.LIST_INVITE_CLEANUP_INTERVAL_MS
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const FROZEN_START = new Date('2026-06-01T00:00:00.000Z')

describe('cleanup-expired-list-invites cron job', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FROZEN_START)
    vi.clearAllMocks()
    vi.mocked(deleteResolvedListInvitesOlderThan).mockResolvedValue(0)
  })

  afterEach(() => {
    cleanupExpiredListInvites.stop()
    vi.useRealTimers()
  })

  it('does not run at startup', () => {
    cleanupExpiredListInvites.start()

    expect(vi.mocked(deleteExpiredPendingListInvites)).not.toHaveBeenCalled()
  })

  it('purges expired pending invites of every list (no listId filter) after the interval elapses', async () => {
    vi.mocked(deleteExpiredPendingListInvites).mockResolvedValueOnce(3)

    cleanupExpiredListInvites.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    const runAt = new Date(FROZEN_START.getTime() + INTERVAL_MS)
    expect(vi.mocked(deleteExpiredPendingListInvites)).toHaveBeenCalledExactlyOnceWith({ now: runAt })
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ processedCount: 3 }, 'Expired list invite cleanup completed')
  })

  it('purges declined and revoked invites resolved more than 30 days ago and sums both counts', async () => {
    vi.mocked(deleteExpiredPendingListInvites).mockResolvedValueOnce(2)
    vi.mocked(deleteResolvedListInvitesOlderThan).mockResolvedValueOnce(5)

    cleanupExpiredListInvites.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    const runAt = FROZEN_START.getTime() + INTERVAL_MS
    expect(vi.mocked(deleteResolvedListInvitesOlderThan)).toHaveBeenCalledExactlyOnceWith(
      new Date(runAt - THIRTY_DAYS_MS),
    )
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ processedCount: 7 }, 'Expired list invite cleanup completed')
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
