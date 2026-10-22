import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type * as HonoRateLimiter from 'hono-rate-limiter'

// Un-mock the globally-mocked (pass-through) hono-rate-limiter and swap in the real module
// so this file can exercise the actual limiter behaviour on POST /v1/feedback.
// We also reset modules so src/app.js and its downstream imports (feedback endpoint,
// rate-limiter util) are re-evaluated with the real limiter module.
describe('POST /v1/feedback — dedicated rate limiter', () => {
  interface AppModule {
    app: { request: (path: string, init?: RequestInit) => Promise<Response> }
  }
  let appModule: AppModule

  beforeAll(async () => {
    vi.doMock('hono-rate-limiter', async () =>
      vi.importActual<typeof HonoRateLimiter>('hono-rate-limiter'),
    )
    vi.resetModules()
    appModule = await import('../../app.js') as unknown as AppModule
  })

  afterAll(() => {
    vi.doUnmock('hono-rate-limiter')
    vi.resetModules()
  })

  async function postFeedback(ip: string): Promise<Response> {
    return appModule.app.request('/v1/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({
        title: 'Spam test',
        description: 'rate-limit smoke',
      }),
    })
  }

  it('returns 429 with Retry-After once the per-minute limit is exceeded for a single IP', async () => {
    const ip = '203.0.113.42'

    // Default per-minute limit is 5 (see env.FEEDBACK_RATE_LIMIT_PER_MINUTE in test setup).
    for (let i = 0; i < 5; i++) {
      const ok = await postFeedback(ip)
      // the insert mock returns undefined (no row) → service returns 500 FEEDBACK_CREATION_FAILED.
      // what matters here is only that the limiter did NOT short-circuit the request.
      expect(ok.status).not.toBe(429)
    }

    const limited = await postFeedback(ip)
    expect(limited.status).toBe(429)
    const retryAfter = limited.headers.get('Retry-After')
    expect(retryAfter).not.toBeNull()
    expect(Number.parseInt(retryAfter ?? '0', 10)).toBeGreaterThan(0)

    const body = await limited.json() as { code: string }
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('counts separately per IP so a different IP is not blocked', async () => {
    const otherIp = '198.51.100.7'
    const first = await postFeedback(otherIp)
    expect(first.status).not.toBe(429)
  })
})
