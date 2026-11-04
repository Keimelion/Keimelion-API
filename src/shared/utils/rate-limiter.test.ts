import { Hono } from 'hono'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { multipartOnly } from './rate-limiter.js'
import { sendError } from './response.js'
import { ErrorCode } from '../enums/error-code.js'
import { HttpStatus } from '../enums/http.js'
import type { MiddlewareHandler } from 'hono'

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
