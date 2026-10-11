import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'

const USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  username: 'testuser',
  passwordHash: 'hashed',
  authProvider: 'email' as const,
  role: 'user' as const,
  avatarUrl: null,
  isCgvAccepted: true,
  cgvAcceptedAt: new Date('2024-01-01'),
  isMarketingOptedIn: false,
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  emailVerifiedAt: new Date('2024-01-02'),
  passwordResetToken: null,
  passwordResetTokenExpiresAt: null,
  lastActiveAt: null,
  deletedAt: null,
  bannedAt: null,
  banReason: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(USER.id)

const TAG_GAMING = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'gaming',
  slug: 'gaming',
  createdByUserId: USER.id,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const TAG_READING = {
  ...TAG_GAMING,
  id: '00000000-0000-0000-0000-000000000011',
  name: 'reading',
  slug: 'reading',
}

function mockUserAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(USER as never)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

describe('GET /v1/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated public tags when authenticated', async () => {
    const token = await generateTestToken(USER.id)
    mockUserAuth()
    vi.mocked(db.query.tags.findMany).mockResolvedValueOnce([TAG_GAMING, TAG_READING] as never)
    mockCountChain(2)

    const response = await apiRequest('/v1/tags', { token })

    const body = await response.json() as {
      items: { id: string; slug: string; name: string }[]
      pagination: { total: number; page: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
    expect(body.items[0]?.slug).toBe('gaming')
    expect(body.items[0]).not.toHaveProperty('createdByUserId')
  })

  it('accepts name query param for substring filter', async () => {
    const token = await generateTestToken(USER.id)
    mockUserAuth()
    vi.mocked(db.query.tags.findMany).mockResolvedValueOnce([TAG_GAMING] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/tags?name=gam', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { slug: string }[] }
    expect(body.items[0]?.slug).toBe('gaming')
  })

  it('returns 422 when name exceeds max length', async () => {
    const token = await generateTestToken(USER.id)
    mockUserAuth()

    const response = await apiRequest(`/v1/tags?name=${'a'.repeat(100)}`, { token })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/tags')
    expect(response.status).toBe(401)
  })
})
