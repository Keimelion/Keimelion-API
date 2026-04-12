import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'
import { app } from '../../app.js'
import { db } from '../../db/client.js'

const TEST_JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'

const SAFE_USER = {
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
  lastActiveAt: null,
  deletedAt: null,
  bannedAt: null,
  banReason: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const TEST_JTI = '00000000-0000-0000-0000-000000000099'
const ACTIVE_TOKEN_ENTRY = { jti: TEST_JTI, userId: SAFE_USER.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }

async function generateTestToken(userId: string, role = 'user'): Promise<string> {
  const secret = new TextEncoder().encode(TEST_JWT_SECRET)
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setJti(TEST_JTI)
    .sign(secret)
}

describe('GET /v1/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.activeTokens.findFirst).mockResolvedValue(ACTIVE_TOKEN_ENTRY as never)
  })

  it('returns 200 with user profile when authenticated', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)

    const response = await app.request('/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })

    const body = await response.json() as { user: { email: string } }
    expect(response.status).toBe(200)
    expect(body.user.email).toBe('user@example.com')
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await app.request('/v1/users/me')
    expect(response.status).toBe(401)
  })

  it('returns 401 when JWT is expired or invalid', async () => {
    const response = await app.request('/v1/users/me', {
      headers: { Authorization: 'Bearer invalidtoken' },
    })
    expect(response.status).toBe(401)
  })

  it('returns 401 when user is deleted', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    const deletedUser = { ...SAFE_USER, deletedAt: new Date('2024-01-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(deletedUser)

    const response = await app.request('/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(401)
  })

  it('returns 403 when user is banned', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    const bannedUser = { ...SAFE_USER, bannedAt: new Date('2024-01-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(bannedUser)

    const response = await app.request('/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(403)
  })
})

describe('PATCH /v1/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.activeTokens.findFirst).mockResolvedValue(ACTIVE_TOKEN_ENTRY as never)
  })

  it('returns 200 with updated profile when body is valid', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    const updatedUser = { ...SAFE_USER, username: 'newusername' }

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([updatedUser]),
        }),
      }),
    } as never)

    const response = await app.request('/v1/users/me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'newusername' }),
    })

    const body = await response.json() as { user: { username: string } }
    expect(response.status).toBe(200)
    expect(body.user.username).toBe('newusername')
  })

  it('returns 422 when avatar_url is not a valid URL', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)

    const response = await app.request('/v1/users/me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ avatarUrl: 'not-a-url' }),
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when username contains invalid characters', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)

    const response = await app.request('/v1/users/me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'invalid username@' }),
    })

    expect(response.status).toBe(422)
  })
})

describe('DELETE /v1/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.activeTokens.findFirst).mockResolvedValue(ACTIVE_TOKEN_ENTRY as never)
  })

  it('returns 200 and soft-deletes the account', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    const deletedUser = { ...SAFE_USER, deletedAt: new Date() }

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([deletedUser]),
        }),
      }),
    } as never)

    const response = await app.request('/v1/users/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('Account deleted successfully')
  })

  it('returns 401 when not authenticated', async () => {
    const response = await app.request('/v1/users/me', { method: 'DELETE' })
    expect(response.status).toBe(401)
  })
})
