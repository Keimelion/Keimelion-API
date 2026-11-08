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
