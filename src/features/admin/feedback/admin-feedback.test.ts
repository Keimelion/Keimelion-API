import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../../db/client.js'
import { apiRequest } from '../../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../../shared/test/auth.js'
import { logger } from '../../../shared/utils/logger.js'

vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const ADMIN_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@example.com',
  username: 'adminuser',
  passwordHash: 'hashed',
  authProvider: 'email' as const,
  role: 'admin' as const,
  avatarUrl: null,
  isCgvAccepted: true,
  cgvAcceptedAt: new Date('2024-01-01'),
  isMarketingOptedIn: false,
  defaultCurrencyCode: 'EUR',
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  emailVerifiedAt: new Date('2024-01-02'),
  passwordResetToken: null,
  passwordResetTokenExpiresAt: null,
  lastActiveAt: null,
  deletedAt: null,
  bannedAt: null,
  banReason: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const NON_ADMIN_USER = {
  ...ADMIN_USER,
  id: '00000000-0000-0000-0000-000000000002',
  email: 'user@example.com',
  role: 'user' as const,
}

const AUTHOR_USER = {
  id: '00000000-0000-0000-0000-000000000050',
  username: 'reporter',
  email: 'reporter@example.com',
}

const FEEDBACK_ID = '00000000-0000-0000-0000-000000000100'

interface FeedbackRow {
  id: string
  userId: string | null
  title: string
  description: string
  context: Record<string, unknown> | null
  status: 'open' | 'reviewed' | 'closed'
  createdAt: Date
  updatedAt: Date
  user: { id: string; username: string | null; email: string } | null
}

function buildFeedbackRow(overrides: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    id: FEEDBACK_ID,
    userId: null,
    title: 'Something is off',
    description: 'The reservation badge is misaligned on mobile.',
    context: null,
    status: 'open',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
    user: null,
    ...overrides,
  }
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(ADMIN_USER.id)

function mockAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER as never)
}

function mockNonAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(
    makeAccessTokenEntry(NON_ADMIN_USER.id) as never,
  )
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(NON_ADMIN_USER as never)
}

function mockFindManyFeedback(rows: FeedbackRow[]): void {
  vi.mocked(db.query.feedback.findMany).mockResolvedValueOnce(rows as never)
}

function mockFindFirstFeedback(row: FeedbackRow | undefined): void {
  vi.mocked(db.query.feedback.findFirst).mockResolvedValueOnce(row as never)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockUpdateFeedback(row: FeedbackRow): void {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([row]),
      }),
    }),
  } as never)
}

describe('GET /v1/admin/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated feedback', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindManyFeedback([buildFeedbackRow()])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/feedback', { token })

    const body = await response.json() as {
      items: { id: string; userId: string | null; user: unknown }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.items[0]?.id).toBe(FEEDBACK_ID)
    expect(body.items[0]?.user).toBeNull()
  })

  it('includes the minimal user block when userId is set', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindManyFeedback([
      buildFeedbackRow({ userId: AUTHOR_USER.id, user: AUTHOR_USER }),
    ])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/feedback', { token })

    const body = await response.json() as {
      items: { userId: string | null; user: { id: string; username: string; email: string } | null }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.user).toEqual(AUTHOR_USER)
  })

  it('omits the user block for anonymous feedback', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindManyFeedback([buildFeedbackRow({ userId: null, user: null })])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/feedback', { token })

    const body = await response.json() as { items: { user: unknown }[] }
    expect(response.status).toBe(200)
    expect(body.items[0]?.user).toBeNull()
  })

  it('accepts a status[eq] filter', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindManyFeedback([buildFeedbackRow({ status: 'reviewed' })])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/feedback?status%5Beq%5D=reviewed', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { status: string }[] }
    expect(body.items[0]?.status).toBe('reviewed')
  })

  it('accepts a userId[eq] filter', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindManyFeedback([buildFeedbackRow({ userId: AUTHOR_USER.id, user: AUTHOR_USER })])
    mockCountChain(1)

    const response = await apiRequest(
      `/v1/admin/feedback?userId%5Beq%5D=${AUTHOR_USER.id}`,
      { token },
    )

    expect(response.status).toBe(200)
  })

  it('accepts a title[ilike] filter', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindManyFeedback([buildFeedbackRow()])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/feedback?title%5Bilike%5D=badge', { token })

    expect(response.status).toBe(200)
  })

  it('accepts a createdAt range (gte + lte)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindManyFeedback([buildFeedbackRow()])
    mockCountChain(1)

    const response = await apiRequest(
      '/v1/admin/feedback?createdAt%5Bgte%5D=2024-01-01T00:00:00Z&createdAt%5Blte%5D=2024-12-31T23:59:59Z',
      { token },
    )

    expect(response.status).toBe(200)
  })

  it('returns 422 when userId filter is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/feedback?userId%5Beq%5D=not-a-uuid', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when status filter uses an unknown value', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/feedback?status%5Beq%5D=rogue', { token })

    expect(response.status).toBe(422)
  })

  it('respects pagination params', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindManyFeedback([buildFeedbackRow()])
    mockCountChain(5)

    const response = await apiRequest('/v1/admin/feedback?page=2&limit=2', { token })

    const body = await response.json() as {
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }
    expect(response.status).toBe(200)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.limit).toBe(2)
    expect(body.pagination.total).toBe(5)
    expect(body.pagination.totalPages).toBe(3)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/feedback', { token })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest('/v1/admin/feedback')
    expect(response.status).toBe(401)
  })
})

describe('PATCH /v1/admin/feedback/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with the updated feedback when transitioning status', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindFirstFeedback(buildFeedbackRow({ status: 'open' }))
    mockUpdateFeedback(buildFeedbackRow({ status: 'reviewed' }))

    const response = await apiRequest(`/v1/admin/feedback/${FEEDBACK_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'reviewed' },
    })

    const body = await response.json() as { feedback: { status: string } }
    expect(response.status).toBe(200)
    expect(body.feedback.status).toBe('reviewed')
  })

  it('preserves the user block on the response after update', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindFirstFeedback(buildFeedbackRow({
      status: 'open',
      userId: AUTHOR_USER.id,
      user: AUTHOR_USER,
    }))
    mockUpdateFeedback(buildFeedbackRow({
      status: 'closed',
      userId: AUTHOR_USER.id,
      user: AUTHOR_USER,
    }))

    const response = await apiRequest(`/v1/admin/feedback/${FEEDBACK_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'closed' },
    })

    const body = await response.json() as {
      feedback: { status: string; user: typeof AUTHOR_USER | null }
    }
    expect(response.status).toBe(200)
    expect(body.feedback.user).toEqual(AUTHOR_USER)
  })

  it('skips the UPDATE when status is unchanged', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindFirstFeedback(buildFeedbackRow({ status: 'reviewed' }))

    const response = await apiRequest(`/v1/admin/feedback/${FEEDBACK_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'reviewed' },
    })

    expect(response.status).toBe(200)
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_update_feedback', changes: {} }),
    )
  })

  it('returns 404 when the feedback id does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindFirstFeedback(undefined)

    const response = await apiRequest(`/v1/admin/feedback/${FEEDBACK_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'reviewed' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('FEEDBACK_NOT_FOUND')
  })

  it('returns 422 when status is not one of the known values', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/feedback/${FEEDBACK_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'rogue' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when an unknown field is included (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/feedback/${FEEDBACK_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'reviewed', title: 'Attempted edit' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/feedback/not-a-uuid', {
      method: 'PATCH',
      token,
      body: { status: 'reviewed' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/feedback/${FEEDBACK_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'reviewed' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest(`/v1/admin/feedback/${FEEDBACK_ID}`, {
      method: 'PATCH',
      body: { status: 'reviewed' },
    })
    expect(response.status).toBe(401)
  })

  it('logs the status change diff on successful update', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindFirstFeedback(buildFeedbackRow({ status: 'open' }))
    mockUpdateFeedback(buildFeedbackRow({ status: 'closed' }))

    await apiRequest(`/v1/admin/feedback/${FEEDBACK_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'closed' },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin_update_feedback',
        feedbackId: FEEDBACK_ID,
        changes: { status: { from: 'open', to: 'closed' } },
      }),
    )
  })
})
