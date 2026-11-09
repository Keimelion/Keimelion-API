import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { ErrorCode } from '@keimelion/sdk/enums'
import type * as HonoRateLimiter from 'hono-rate-limiter'

const WAITLIST_SIGNUP_LIMIT = 3

describe('POST /v1/public/waitlist — rate limiter', () => {
  interface AppModule {
    app: { request: (path: string, init?: RequestInit) => Promise<Response> }
  }
  let appModule: AppModule

  beforeAll(async () => {
    vi.doMock('hono-rate-limiter', async () =>
      vi.importActual<typeof HonoRateLimiter>('hono-rate-limiter'),
    )
    vi.resetModules()
    appModule = (await import('../../app.js')) as unknown as AppModule
  })

  afterAll(() => {
    vi.doUnmock('hono-rate-limiter')
    vi.resetModules()
  })

  async function postWaitlistFrom(ip: string): Promise<Response> {
    return appModule.app.request('/v1/public/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({}),
    })
  }

  it('returns 429 once the per-minute limit is exceeded for a single IP', async () => {
    const ip = '203.0.113.77'
    const allowedResponses = await Promise.all(
      Array.from({ length: WAITLIST_SIGNUP_LIMIT }, () => postWaitlistFrom(ip)),
    )
    expect(allowedResponses.map((response) => response.status)).toEqual([422, 422, 422])

    const limited = await postWaitlistFrom(ip)

    expect(limited.status).toBe(429)
    const body = (await limited.json()) as { code: string }
    expect(body.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
  })

  it('counts separately per IP', async () => {
    const response = await postWaitlistFrom('198.51.100.77')

    expect(response.status).toBe(422)
  })
})
