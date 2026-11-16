import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { env } from '../../config/env.js'
import { db } from '../../db/client.js'
import { logger } from '../../shared/utils/logger.js'
import { markInactiveUsersJob } from './mark-inactive-users.js'

const INTERVAL_MS = env.USER_INACTIVITY_STATUS_INTERVAL_MS
const START = new Date('2026-11-16T03:00:00.000Z')

function mockStatusUpdate(updatedIds: string[]): { set: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn> } {
  const where = vi.fn().mockReturnValueOnce({
    returning: vi.fn().mockResolvedValueOnce(updatedIds.map((id) => ({ id }))),
  })
  const set = vi.fn().mockReturnValueOnce({ where })
  vi.mocked(db.update).mockReturnValueOnce({ set } as never)
  return { set, where }
}

describe('mark-inactive-users cron job', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    vi.clearAllMocks()
  })

  afterEach(() => {
    markInactiveUsersJob.stop()
    vi.useRealTimers()
  })

  it('runs daily by default and not at startup', () => {
    markInactiveUsersJob.start()

    expect(INTERVAL_MS).toBe(86_400_000)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('moves active users with no activity for 12 months to inactive', async () => {
    const { set, where } = mockStatusUpdate(['user-1', 'user-2'])

    markInactiveUsersJob.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    const condition = new PgDialect().sqlToQuery(where.mock.calls[0]?.[0] as SQL)
    expect(set).toHaveBeenCalledExactlyOnceWith({ userStatus: 'inactive' })
    expect(condition.sql).toBe(
      '("users"."user_status" = $1 and COALESCE("users"."last_active_at", "users"."created_at") < $2::timestamptz)',
    )
    expect(condition.params).toEqual(['active', '2025-11-17T03:00:00.000Z'])
    expect(logger.info).toHaveBeenCalledWith({ processedCount: 2 }, 'Mark inactive users completed')
  })

  it('logs the error and keeps running when the update throws', async () => {
    const error = new Error('DB failure')
    vi.mocked(db.update).mockImplementationOnce(() => {
      throw error
    })
    mockStatusUpdate([])

    markInactiveUsersJob.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(logger.error).toHaveBeenCalledWith({ error }, 'Mark inactive users failed')

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(logger.info).toHaveBeenCalledWith({ processedCount: 0 }, 'Mark inactive users completed')
  })
})
