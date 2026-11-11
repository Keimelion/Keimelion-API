import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorCode } from '@keimelion/sdk/enums'
import { app } from './app.js'
import { db } from './db/client.js'

const CORP = 'Cross-Origin-Resource-Policy'

describe('Cross-Origin-Resource-Policy header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is same-origin on normal routes (secureHeaders default)', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([] as never)
    const res = await app.request('/health')
    expect(res.headers.get(CORP)).toBe('same-origin')
  })

  it('is overridden to cross-origin on /uploads/* so the BackOffice can load images via <img>', async () => {
    const res = await app.request('/uploads/does-not-exist.webp')
    expect(res.headers.get(CORP)).toBe('cross-origin')
  })
})

describe('Email assets', () => {
  it('serves the email images cross-origin and cacheable, in every environment', async () => {
    const res = await app.request('/assets/mail/banner-waitlist.png')

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get(CORP)).toBe('cross-origin')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=604800')
  })

  it('answers 404 without the cache headers for an unknown file', async () => {
    const res = await app.request('/assets/mail/unknown.png')

    expect(res.status).toBe(404)
    expect(res.headers.get('Cache-Control')).toBeNull()
  })

  it('does not serve files outside the email assets folder', async () => {
    const res = await app.request('/assets/mail/..%2F..%2Fpackage.json')

    expect(res.status).toBe(404)
  })
})

describe('Global error handler', () => {
  it('returns 400 BAD_REQUEST on a malformed JSON body', async () => {
    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: ErrorCode.BAD_REQUEST })
  })
})
