import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../db/entities/users/users.repository.js', () => ({
  findUsersEligibleForHardDelete: vi.fn(),
  hardDeleteUser: vi.fn(),
  insertDeletionAudit: vi.fn(),
}))

vi.mock('../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

import { findUsersEligibleForHardDelete, hardDeleteUser, insertDeletionAudit } from '../db/entities/users/users.repository.js'
import { db } from '../db/client.js'
import { logger } from '../shared/utils/logger.js'
import { start, stop } from './hard-delete-inactive-users.js'
import type { User } from '../db/entities/users/users.schema.js'

const INTERVAL_MS = 60_000
const GRACE_DAYS = 30

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-1',
    email: 'user@example.com',
    username: null,
    passwordHash: null,
    authProvider: 'email',
    role: 'user',
    avatarUrl: null,
    isCgvAccepted: false,
    cgvAcceptedAt: null,
    isMarketingOptedIn: false,
    emailVerifyToken: null,
    emailVerifyTokenExpiresAt: null,
    emailVerifiedAt: null,
    lastActiveAt: null,
    deletedAt: null,
    bannedAt: null,
    banReason: null,
    createdAt: new Date('2020-01-01'),
    updatedAt: new Date('2020-01-01'),
    ...overrides,
  }
}

describe('hard-delete-inactive-users cron job', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      const fakeTx = {} as Parameters<Parameters<typeof db.transaction>[0]>[0]
      return callback(fakeTx)
    })
  })

  afterEach(() => {
    stop()
    vi.useRealTimers()
  })

  it('does not run at startup', () => {
    start(INTERVAL_MS, GRACE_DAYS)
    expect(vi.mocked(findUsersEligibleForHardDelete)).not.toHaveBeenCalled()
  })

  it('runs after the interval elapses', async () => {
    vi.mocked(findUsersEligibleForHardDelete).mockResolvedValueOnce([])
    start(INTERVAL_MS, GRACE_DAYS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(findUsersEligibleForHardDelete)).toHaveBeenCalledOnce()
  })

  it('hard-deletes soft-deleted grace users and logs count', async () => {
    const user = makeUser({ deletedAt: new Date('2020-01-01') })
    vi.mocked(findUsersEligibleForHardDelete).mockResolvedValueOnce([
      { user, reason: 'soft_delete_grace' },
    ])
    start(INTERVAL_MS, GRACE_DAYS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      { deletedCount: 1 },
      'Hard-delete inactive users completed',
    )
  })

  it('hard-deletes inactive users and logs count', async () => {
    const user = makeUser()
    vi.mocked(findUsersEligibleForHardDelete).mockResolvedValueOnce([
      { user, reason: 'inactive_24mo' },
    ])
    start(INTERVAL_MS, GRACE_DAYS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      { deletedCount: 1 },
      'Hard-delete inactive users completed',
    )
  })

  it('does not touch ineligible users', async () => {
    vi.mocked(findUsersEligibleForHardDelete).mockResolvedValueOnce([])
    start(INTERVAL_MS, GRACE_DAYS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      { deletedCount: 0 },
      'Hard-delete inactive users completed',
    )
  })

  it('inserts audit row in same transaction as delete', async () => {
    const user = makeUser({ deletedAt: new Date('2020-01-01') })
    vi.mocked(findUsersEligibleForHardDelete).mockResolvedValueOnce([
      { user, reason: 'soft_delete_grace' },
    ])
    start(INTERVAL_MS, GRACE_DAYS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(insertDeletionAudit)).toHaveBeenCalledOnce()
    expect(vi.mocked(hardDeleteUser)).toHaveBeenCalledOnce()
    const insertCall = vi.mocked(insertDeletionAudit).mock.calls[0]
    const deleteCall = vi.mocked(hardDeleteUser).mock.calls[0]
    expect(insertCall).toBeDefined()
    expect(deleteCall).toBeDefined()
    expect(insertCall?.[1]).toMatchObject({
      userId: user.id,
      email: user.email,
      deletedAt: user.deletedAt,
      reason: 'soft_delete_grace',
    })
    expect(deleteCall?.[0]).toBe(user.id)
  })

  it('logs error and continues when a per-user transaction fails', async () => {
    const failingUser = makeUser({ id: 'user-1', email: 'fail@example.com' })
    const successUser = makeUser({ id: 'user-2', email: 'success@example.com' })
    vi.mocked(findUsersEligibleForHardDelete).mockResolvedValueOnce([
      { user: failingUser, reason: 'inactive_24mo' },
      { user: successUser, reason: 'inactive_24mo' },
    ])
    const transactionError = new Error('DB transaction failure')
    vi.mocked(db.transaction)
      .mockRejectedValueOnce(transactionError)
      .mockImplementationOnce(async (callback) => {
        const fakeTx = {} as Parameters<Parameters<typeof db.transaction>[0]>[0]
        return callback(fakeTx)
      })
    start(INTERVAL_MS, GRACE_DAYS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      { error: transactionError },
      'Failed to hard-delete user',
    )
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      { deletedCount: 1 },
      'Hard-delete inactive users completed',
    )
  })

  it('overlap guard prevents concurrent runs', async () => {
    let resolveFirst!: (value: unknown) => void
    const firstRunPromise = new Promise((resolve) => {
      resolveFirst = resolve
    })
    vi.mocked(findUsersEligibleForHardDelete).mockReturnValueOnce(
      firstRunPromise as Promise<never>,
    )
    vi.mocked(findUsersEligibleForHardDelete).mockResolvedValue([])
    start(INTERVAL_MS, GRACE_DAYS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(findUsersEligibleForHardDelete)).toHaveBeenCalledOnce()
    resolveFirst([])
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(findUsersEligibleForHardDelete)).toHaveBeenCalledTimes(2)
  })

  it('stop cancels scheduled runs', async () => {
    vi.mocked(findUsersEligibleForHardDelete).mockResolvedValue([])
    start(INTERVAL_MS, GRACE_DAYS)
    stop()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3)
    expect(vi.mocked(findUsersEligibleForHardDelete)).not.toHaveBeenCalled()
  })

  it('logs error when findUsersEligibleForHardDelete throws', async () => {
    const error = new Error('DB failure')
    vi.mocked(findUsersEligibleForHardDelete).mockRejectedValueOnce(error)
    start(INTERVAL_MS, GRACE_DAYS)
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      { error },
      'Hard-delete inactive users failed',
    )
  })
})
