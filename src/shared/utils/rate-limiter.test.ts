import { Hono } from 'hono'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authAwareRateLimiter, multipartOnly } from './rate-limiter.js'
import { sendError } from './response.js'
import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import { HonoContextKey } from '../enums/context-key.js'
import { makeAdminUser } from '../test/fixtures/users.js'
import type { MiddlewareHandler } from 'hono'
import type { AppVariables } from '../types/app.js'

describe('multipartOnly', () => {
  const rejectingLimiter = vi.fn<MiddlewareHandler>()

  function buildApp(): Hono {
    return new Hono().post('/', multipartOnly(rejectingLimiter), (context) => context.text('ok'))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    rejectingLimiter.mockImplementation(() => Promise.resolve(sendError(ErrorCode.RATE_LIMIT_EXCEEDED)))
  })

  it('applies the wrapped middleware to multipart requests', async () => {
    const form = new FormData()
    form.append('name', 'value')

    const response = await buildApp().request('/', { method: 'POST', body: form })

    expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS)
    expect(rejectingLimiter).toHaveBeenCalledOnce()
  })

  it('skips the wrapped middleware for JSON requests', async () => {
    const response = await buildApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    expect(response.status).toBe(HttpStatus.OK)
    expect(rejectingLimiter).not.toHaveBeenCalled()
  })

  it('lets multipart requests under the body limit reach the handler', async () => {
    rejectingLimiter.mockImplementation(async (_context, next) => {
      await next()
    })
    const form = new FormData()
    form.append('name', 'value')

    const response = await buildApp().request('/', { method: 'POST', body: form })

    expect(response.status).toBe(HttpStatus.OK)
    expect(await response.text()).toBe('ok')
  })
})

describe('authAwareRateLimiter', () => {
  const authenticatedLimiter = vi.fn<MiddlewareHandler>()
  const anonymousLimiter = vi.fn<MiddlewareHandler>()

  function buildApp(isAuthenticated: boolean): Hono<{ Variables: AppVariables }> {
    return new Hono<{ Variables: AppVariables }>().post(
      '/',
      async (context, next) => {
        if (isAuthenticated) context.set(HonoContextKey.USER, makeAdminUser())
        await next()
      },
      authAwareRateLimiter(authenticatedLimiter, anonymousLimiter),
      (context) => context.text('ok'),
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const passThrough: MiddlewareHandler = async (_context, next) => {
      await next()
    }
    authenticatedLimiter.mockImplementation(passThrough)
    anonymousLimiter.mockImplementation(passThrough)
  })

  it('applies the authenticated limiter when a user is on the context', async () => {
    const response = await buildApp(true).request('/', { method: 'POST' })

    expect(response.status).toBe(HttpStatus.OK)
    expect(authenticatedLimiter).toHaveBeenCalledOnce()
    expect(anonymousLimiter).not.toHaveBeenCalled()
  })

  it('applies the anonymous limiter when no user is on the context', async () => {
    const response = await buildApp(false).request('/', { method: 'POST' })

    expect(response.status).toBe(HttpStatus.OK)
    expect(anonymousLimiter).toHaveBeenCalledOnce()
    expect(authenticatedLimiter).not.toHaveBeenCalled()
  })
})
