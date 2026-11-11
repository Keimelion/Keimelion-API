import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../db/entities/waitlist/waitlist.repository.js', () => ({
  deleteExpiredUnconfirmedWaitlistEntries: vi.fn(),
  deleteWaitlistEntriesLaunchEmailedBefore: vi.fn(),
}))

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { env } from '../../config/env.js'
import {
  deleteExpiredUnconfirmedWaitlistEntries,
  deleteWaitlistEntriesLaunchEmailedBefore,
} from '../../db/entities/waitlist/waitlist.repository.js'
import { logger } from '../../shared/utils/logger.js'
import { purgeWaitlistEntries } from './purge-waitlist-entries.js'

const INTERVAL_MS = env.WAITLIST_PURGE_INTERVAL_MS
const START = new Date('2027-03-31T10:00:00.000Z')
const FIRST_RUN_AT = new Date(START.getTime() + INTERVAL_MS)

describe('purge-waitlist-entries cron job', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    vi.clearAllMocks()
  })

  afterEach(() => {
    purgeWaitlistEntries.stop()
    vi.useRealTimers()
  })

  it('does not run at startup', () => {
    purgeWaitlistEntries.start()

    expect(deleteExpiredUnconfirmedWaitlistEntries).not.toHaveBeenCalled()
    expect(deleteWaitlistEntriesLaunchEmailedBefore).not.toHaveBeenCalled()
  })

  it('deletes unconfirmed entries whose link expired and entries emailed at launch 12 months ago', async () => {
    vi.mocked(deleteExpiredUnconfirmedWaitlistEntries).mockResolvedValueOnce(2)
    vi.mocked(deleteWaitlistEntriesLaunchEmailedBefore).mockResolvedValueOnce(3)

    purgeWaitlistEntries.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(deleteExpiredUnconfirmedWaitlistEntries).toHaveBeenCalledExactlyOnceWith(FIRST_RUN_AT)
    expect(deleteWaitlistEntriesLaunchEmailedBefore).toHaveBeenCalledExactlyOnceWith(
      new Date('2026-03-31T11:00:00.000Z'),
    )
    expect(logger.info).toHaveBeenCalledWith(
      { deletedCount: 5 },
      'Waitlist entries purge completed',
    )
  })

  it('logs the error and keeps running when a purge throws', async () => {
    const error = new Error('DB failure')
    vi.mocked(deleteExpiredUnconfirmedWaitlistEntries).mockRejectedValueOnce(error)
    vi.mocked(deleteExpiredUnconfirmedWaitlistEntries).mockResolvedValueOnce(0)
    vi.mocked(deleteWaitlistEntriesLaunchEmailedBefore).mockResolvedValue(0)

    purgeWaitlistEntries.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(logger.error).toHaveBeenCalledWith({ error }, 'Waitlist entries purge failed')

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(deleteExpiredUnconfirmedWaitlistEntries).toHaveBeenCalledTimes(2)
  })

  it('stop cancels scheduled runs', async () => {
    purgeWaitlistEntries.start()
    purgeWaitlistEntries.stop()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3)

    expect(deleteExpiredUnconfirmedWaitlistEntries).not.toHaveBeenCalled()
  })
})
