import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { env } from '../../config/env.js'
import { createFeatureRouter } from '../types/app.js'
import { generateTestToken, makeAccessTokenEntry } from '../test/auth.js'
import { ONE_DAY_MS } from '../utils/time.js'
import { getOptionalAuthUser, optionalAuthMiddleware } from './optional-auth.js'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const VERIFIED_USER = {
  id: USER_ID,
  role: 'user' as const,
  emailVerifiedAt: new Date('2024-01-02'),
  createdAt: new Date('2024-01-01'),
  deletedAt: null,
  bannedAt: null,
}

const app = createFeatureRouter()
app.get('/whoami', optionalAuthMiddleware, (context) => context.json({ userId: getOptionalAuthUser(context)?.id ?? null }))

async function requestWhoAmI(): Promise<{ userId: string | null }> {
  const token = await generateTestToken(USER_ID)
  const response = await app.request('/whoami', { headers: { Authorization: `Bearer ${token}` } })
  return await response.json() as { userId: string | null }
}

describe('optionalAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(makeAccessTokenEntry(USER_ID))
  })

  it('resolves a verified account', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VERIFIED_USER as never)

    expect(await requestWhoAmI()).toEqual({ userId: USER_ID })
  })

  it('resolves an unverified account before its verification deadline', async () => {
    const createdAt = new Date(Date.now() - ONE_DAY_MS)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...VERIFIED_USER, emailVerifiedAt: null, createdAt } as never)

    expect(await requestWhoAmI()).toEqual({ userId: USER_ID })
  })

  it('treats an unverified account as anonymous from its verification deadline on', async () => {
    const createdAt = new Date(Date.now() - env.EMAIL_VERIFICATION_GRACE_DAYS * ONE_DAY_MS)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...VERIFIED_USER, emailVerifiedAt: null, createdAt } as never)

    expect(await requestWhoAmI()).toEqual({ userId: null })
  })
})
