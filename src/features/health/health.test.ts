import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../../app.js'
import { db } from '../../db/client.js'
import type { HealthResult } from './health.service.js'

describe('GET /v1/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with ok status when database is healthy', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([] as never)

    const res = await app.request('/v1/health')
    const body = await res.json() as HealthResult

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.database).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
    expect(typeof body.version).toBe('string')
  })

  it('returns 500 with degraded status when database fails', async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error('Connection refused'))

    const res = await app.request('/v1/health')
    const body = await res.json() as HealthResult

    expect(res.status).toBe(500)
    expect(body.status).toBe('degraded')
    expect(body.database).toBe('error')
    expect(typeof body.timestamp).toBe('string')
    expect(typeof body.version).toBe('string')
  })
})
