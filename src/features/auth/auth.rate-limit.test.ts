import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { ErrorCode } from '@keimelion/sdk/enums'
import type * as HonoRateLimiter from 'hono-rate-limiter'

const SENSITIVE_LIMIT = 10

describe('auth email verification rate limiters', () => {
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

  async function postFrom(path: string, ip: string): Promise<Response> {
    return appModule.app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({}),
    })
  }

  it.each([
    ['/v1/auth/verify-email', '203.0.113.21'],
    ['/v1/auth/resend-verification', '203.0.113.22'],
  ])('returns 429 on %s once RATE_LIMITS.SENSITIVE is exceeded for a single IP', async (path, ip) => {
    const allowedResponses = await Promise.all(
      Array.from({ length: SENSITIVE_LIMIT }, () => postFrom(path, ip)),
    )
    expect(new Set(allowedResponses.map((response) => response.status))).toEqual(new Set([422]))

    const limited = await postFrom(path, ip)

    expect(limited.status).toBe(429)
    const body = (await limited.json()) as { code: string }
    expect(body.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
  })

  it('counts each IP separately', async () => {
    const response = await postFrom('/v1/auth/resend-verification', '198.51.100.22')

    expect(response.status).toBe(422)
  })
})
