import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type * as HonoRateLimiter from 'hono-rate-limiter'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'
import { makeAdminUser } from '../../shared/test/fixtures/users.js'
import type { Report } from '../../db/entities/reports/reports.schema.js'

// Un-mock the globally-mocked (pass-through) hono-rate-limiter and re-import the app so the
// real limiter guards POST /v1/reports.
describe('POST /v1/reports — dedicated per-user rate limiter', () => {
  interface AppModule {
    app: { request: (path: string, init?: RequestInit) => Promise<Response> }
  }
  interface DbModule {
    db: {
      query: {
        accessTokens: { findFirst: ReturnType<typeof vi.fn> }
        users: { findFirst: ReturnType<typeof vi.fn> }
      }
      insert: ReturnType<typeof vi.fn>
    }
  }

  const REPORT_RATE_LIMIT_PER_MINUTE = 5
  let appModule: AppModule
  let dbModule: DbModule

  beforeAll(async () => {
    vi.doMock('hono-rate-limiter', async () =>
      vi.importActual<typeof HonoRateLimiter>('hono-rate-limiter'),
    )
    vi.resetModules()
    appModule = await import('../../app.js') as unknown as AppModule
    dbModule = await import('../../db/client.js') as unknown as DbModule
  })

  afterAll(() => {
    vi.doUnmock('hono-rate-limiter')
    vi.resetModules()
  })

  function buildReportRow(userId: string): Report {
    return {
      id: '00000000-0000-0000-0000-000000000799',
      userId,
      targetType: 'user',
      targetId: userId,
      targetSnapshot: {},
      targetImageId: null,
      reason: 'spam',
      description: null,
      reportStatus: 'pending',
      adminNote: null,
      reviewedByUserId: null,
      reviewedAt: null,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
    }
  }

  async function postReportAs(userId: string): Promise<Response> {
    const reporter = makeAdminUser({ id: userId, role: 'user' })
    dbModule.db.query.accessTokens.findFirst.mockResolvedValue(makeAccessTokenEntry(userId))
    dbModule.db.query.users.findFirst.mockResolvedValue(reporter)
    dbModule.db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([buildReportRow(userId)]) }),
    })
    const token = await generateTestToken(userId)
    return appModule.app.request('/v1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetType: 'user', targetId: userId, reason: 'spam' }),
    })
  }

  it('returns 429 with Retry-After once the per-minute limit is exceeded for a single user', async () => {
    const userId = '00000000-0000-0000-0000-000000000701'
    for (let attempt = 0; attempt < REPORT_RATE_LIMIT_PER_MINUTE; attempt++) {
      const response = await postReportAs(userId)
      expect(response.status).toBe(201)
    }

    const limited = await postReportAs(userId)

    expect(limited.status).toBe(429)
    expect(Number.parseInt(limited.headers.get('Retry-After') ?? '0', 10)).toBeGreaterThan(0)
    const body = await limited.json() as { code: string }
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('counts separately per user so another account is not blocked', async () => {
    const response = await postReportAs('00000000-0000-0000-0000-000000000702')

    expect(response.status).toBe(201)
  })
})
