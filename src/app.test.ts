import { describe, it, expect, vi, beforeEach } from 'vitest'
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
