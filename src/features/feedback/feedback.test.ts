import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'

const AUTH_USER = {
  id: '00000000-0000-0000-0000-000000000100',
  email: 'user@example.com',
  username: 'reporter',
  passwordHash: 'hashed',
  authProvider: 'email' as const,
  role: 'user' as const,
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

const AUTH_ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(AUTH_USER.id)

const FEEDBACK_ID = '00000000-0000-0000-0000-000000000200'

interface FeedbackRow {
  id: string
  userId: string | null
  title: string
  description: string
  context: Record<string, unknown> | null
  status: 'open' | 'reviewed' | 'closed'
  createdAt: Date
  updatedAt: Date
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
    ...overrides,
  }
}

function mockInsertReturning(row: FeedbackRow): ReturnType<typeof vi.fn> {
  const valuesSpy = vi.fn().mockReturnValueOnce({
    returning: vi.fn().mockResolvedValueOnce([row]),
  })
  vi.mocked(db.insert).mockReturnValueOnce({ values: valuesSpy } as never)
  return valuesSpy
}

function mockInsertReturningEmpty(): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([]),
    }),
  } as never)
}

describe('POST /v1/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 with userId=null for an anonymous submission', async () => {
    const valuesSpy = mockInsertReturning(buildFeedbackRow())

    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      body: {
        title: 'Something is off',
        description: 'The reservation badge is misaligned on mobile.',
      },
    })

    const body = await response.json() as {
      feedback: { id: string; userId: string | null; title: string; status: string }
    }
    expect(response.status).toBe(201)
    expect(body.feedback.id).toBe(FEEDBACK_ID)
    expect(body.feedback.userId).toBeNull()
    expect(body.feedback.status).toBe('open')
    const insertedRow = valuesSpy.mock.calls[0]?.[0] as { userId: string | null }
    expect(insertedRow.userId).toBeNull()
  })

  it('returns 201 and attaches userId for an authenticated submission', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(AUTH_ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER as never)
    const row = buildFeedbackRow({ userId: AUTH_USER.id })
    const valuesSpy = mockInsertReturning(row)

    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      token,
      body: {
        title: 'Nice to have',
        description: 'Add dark mode to the dashboard.',
      },
    })

    const body = await response.json() as {
      feedback: { id: string; userId: string | null }
    }
    expect(response.status).toBe(201)
    expect(body.feedback.userId).toBe(AUTH_USER.id)
    const insertedRow = valuesSpy.mock.calls[0]?.[0] as { userId: string | null }
    expect(insertedRow.userId).toBe(AUTH_USER.id)
  })

  it('persists context jsonb verbatim', async () => {
    const context = {
      userAgent: 'Mozilla/5.0',
      url: 'https://app.keimelion.fr/lists/42',
      viewport: { width: 1280, height: 720 },
      appVersion: '2.3.1',
      locale: 'en-US',
    }
    const row = buildFeedbackRow({ context })
    const valuesSpy = mockInsertReturning(row)

    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      body: {
        title: 'Something is off',
        description: 'Noticed a glitch.',
        context,
      },
    })

    const body = await response.json() as {
      feedback: { context: typeof context }
    }
    expect(response.status).toBe(201)
    expect(body.feedback.context).toEqual(context)
    const insertedRow = valuesSpy.mock.calls[0]?.[0] as { context: typeof context }
    expect(insertedRow.context).toEqual(context)
  })

  it('persists userId=null when the Authorization token is invalid', async () => {
    const valuesSpy = mockInsertReturning(buildFeedbackRow())

    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      token: 'not-a-valid-jwt',
      body: {
        title: 'Anon-ish',
        description: 'Token is garbage, treat me as anonymous.',
      },
    })

    expect(response.status).toBe(201)
    const insertedRow = valuesSpy.mock.calls[0]?.[0] as { userId: string | null }
    expect(insertedRow.userId).toBeNull()
  })

  it('returns 422 when title is missing', async () => {
    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      body: { description: 'No title here' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when title is an empty string', async () => {
    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      body: { title: '', description: 'Has a description but no title' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('UNPROCESSABLE_ENTITY')
  })

  it('returns 422 when title exceeds the max length', async () => {
    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      body: {
        title: 'a'.repeat(201),
        description: 'Short desc',
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when description is missing', async () => {
    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      body: { title: 'Only title' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when description is an empty string', async () => {
    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      body: { title: 'Something', description: '' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when description exceeds the max length', async () => {
    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      body: {
        title: 'Short title',
        description: 'a'.repeat(10_001),
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when an unknown field is sent (strict schema)', async () => {
    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      body: {
        title: 'Short title',
        description: 'Short desc',
        rogueField: 'nope',
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 500 FEEDBACK_CREATION_FAILED when the insert returns no row', async () => {
    mockInsertReturningEmpty()

    const response = await apiRequest('/v1/feedback', {
      method: 'POST',
      body: {
        title: 'Short title',
        description: 'Short desc',
      },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(500)
    expect(body.code).toBe('FEEDBACK_CREATION_FAILED')
  })
})
