import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'
import { app } from '../../app.js'
import { db } from '../../db/client.js'

const TEST_JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'
const TEST_JTI = '00000000-0000-0000-0000-000000000099'

async function generateTestToken(userId: string, options: { includeJti?: boolean } = {}): Promise<string> {
  const { includeJti = true } = options
  const secret = new TextEncoder().encode(TEST_JWT_SECRET)
  const builder = new SignJWT({ sub: userId, role: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
  if (includeJti) {
    builder.setJti(TEST_JTI)
  }
  return builder.sign(secret)
}

const VALID_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  username: 'testuser',
  passwordHash: '$2a$04$somevalidhashvalue.thatislong.enoughfortest',
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

describe('POST /v1/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 with user when registration is successful', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([VALID_USER]),
      }),
    } as never)

    const response = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'securepassword123',
        isCgvAccepted: true,
      }),
    })

    const body = await response.json() as { user: { id: string; email: string } }
    expect(response.status).toBe(201)
    expect(body.user.email).toBe('user@example.com')
  })

  it('returns 409 when email already exists', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)

    const response = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'securepassword123',
        isCgvAccepted: true,
      }),
    })

    expect(response.status).toBe(409)
  })

  it('returns 422 when username contains invalid characters', async () => {
    const response = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'securepassword123',
        isCgvAccepted: true,
        username: 'invalid username with spaces',
      }),
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when password is too short', async () => {
    const response = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'short',
        isCgvAccepted: true,
      }),
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /v1/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 when token is valid', async () => {
    const validToken = '00000000-0000-0000-0000-000000000099'
    const userWithToken = {
      ...VALID_USER,
      emailVerifiedAt: null,
      emailVerifyToken: validToken,
      emailVerifyTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithToken)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([VALID_USER]),
        }),
      }),
    } as never)

    const response = await app.request('/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: validToken }),
    })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('Email verified successfully')
  })

  it('returns 400 when token is invalid', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await app.request('/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '00000000-0000-0000-0000-000000000000' }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 400 when token is expired', async () => {
    const expiredToken = '00000000-0000-0000-0000-000000000099'
    const userWithExpiredToken = {
      ...VALID_USER,
      emailVerifiedAt: null,
      emailVerifyToken: expiredToken,
      emailVerifyTokenExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
    }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithExpiredToken)

    const response = await app.request('/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expiredToken }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 422 when token is not a valid uuid', async () => {
    const response = await app.request('/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'not-a-uuid' }),
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /v1/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with token and user when credentials are valid', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('securepassword123', 4)
    const userWithHash = { ...VALID_USER, passwordHash: hash }

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithHash)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([userWithHash]),
        }),
      }),
    } as never)

    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'securepassword123' }),
    })

    const body = await response.json() as { token: string; user: { email: string } }
    expect(response.status).toBe(200)
    expect(typeof body.token).toBe('string')
    expect(body.user.email).toBe('user@example.com')
  })

  it('returns 401 when email is unknown', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.com', password: 'somepassword' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when password is incorrect', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('correctpassword', 4)
    const userWithHash = { ...VALID_USER, passwordHash: hash }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithHash)

    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'wrongpassword' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 403 when email is not verified', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('securepassword123', 4)
    const unverifiedUser = { ...VALID_USER, passwordHash: hash, emailVerifiedAt: null }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(unverifiedUser)

    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'securepassword123' }),
    })

    expect(response.status).toBe(403)
  })

  it('returns 403 when account is banned', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('securepassword123', 4)
    const bannedUser = { ...VALID_USER, passwordHash: hash, bannedAt: new Date('2024-01-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(bannedUser)

    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'securepassword123' }),
    })

    expect(response.status).toBe(403)
  })
})

describe('POST /v1/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 204 when logout is successful', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.tokenBlacklist.findFirst).mockResolvedValueOnce(undefined)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)

    const response = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(204)
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await app.request('/v1/auth/logout', {
      method: 'POST',
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when JWT has no jti claim', async () => {
    const token = await generateTestToken(VALID_USER.id, { includeJti: false })

    const response = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when token is blacklisted', async () => {
    const token = await generateTestToken(VALID_USER.id)
    const blacklistedEntry = { jti: TEST_JTI, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }
    vi.mocked(db.query.tokenBlacklist.findFirst).mockResolvedValueOnce(blacklistedEntry as never)

    const response = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(401)
  })

  it('returns 500 when the logout transaction fails', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.tokenBlacklist.findFirst).mockResolvedValueOnce(undefined)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.transaction).mockRejectedValueOnce(new Error('DB error'))

    const response = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(500)
  })
})
