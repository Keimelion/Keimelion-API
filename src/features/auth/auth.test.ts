import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'
import { app } from '../../app.js'
import { db } from '../../db/client.js'
import { env } from '../../config/env.js'
import { NodeEnvs } from '../../shared/enums/node-env.js'

const TEST_JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'
const TEST_JTI = '00000000-0000-0000-0000-000000000099'
const TEST_REFRESH_TOKEN_HASH = 'a'.repeat(64)

async function generateTestToken(userId: string, options: { includeJti?: boolean; expired?: boolean } = {}): Promise<string> {
  const { includeJti = true, expired = false } = options
  const secret = new TextEncoder().encode(TEST_JWT_SECRET)
  const now = Math.floor(Date.now() / 1000)
  const builder = new SignJWT({ sub: userId, role: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(expired ? now - 7200 : now)
    .setExpirationTime(expired ? now - 3600 : now + 3600)
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
  passwordResetToken: null,
  passwordResetTokenExpiresAt: null,
  lastActiveAt: null,
  deletedAt: null,
  bannedAt: null,
  banReason: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const ACTIVE_TOKEN_ENTRY = { jti: TEST_JTI, userId: VALID_USER.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }

const VALID_REFRESH_TOKEN_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  userId: VALID_USER.id,
  tokenHash: TEST_REFRESH_TOKEN_HASH,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date('2024-01-01'),
  revokedAt: null,
}

function mockInsertReturning(returnValue: unknown): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnValue]),
    }),
  } as never)
}

function mockInsertNoReturning(): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockResolvedValueOnce(undefined),
  } as never)
}

describe('POST /v1/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 with user and refreshToken when registration is successful', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
    mockInsertReturning(VALID_USER)
    mockInsertNoReturning()

    const response = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'securepassword123',
        isCgvAccepted: true,
      }),
    })

    const body = await response.json() as { user: { id: string; email: string }; refreshToken: string }
    expect(response.status).toBe(201)
    expect(body.user.email).toBe('user@example.com')
    expect(typeof body.refreshToken).toBe('string')
    expect(body.refreshToken.length).toBeGreaterThan(0)
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

  it('returns 200 with accessToken, refreshToken, and user when credentials are valid', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('securepassword123', 4)
    const userWithHash = { ...VALID_USER, passwordHash: hash }

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithHash)
    mockInsertNoReturning()

    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'securepassword123' }),
    })

    const body = await response.json() as { accessToken: string; refreshToken: string; user: { email: string } }
    expect(response.status).toBe(200)
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')
    expect(body.refreshToken.length).toBeGreaterThan(0)
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

  it('returns 204 and runs transaction when logout is successful', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.query.activeTokens.findFirst).mockResolvedValueOnce(ACTIVE_TOKEN_ENTRY as never)

    const response = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(204)
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await app.request('/v1/auth/logout', {
      method: 'POST',
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when JWT is expired', async () => {
    const token = await generateTestToken(VALID_USER.id, { expired: true })

    const response = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
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

  it('returns 401 when token is not active', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.query.activeTokens.findFirst).mockResolvedValueOnce(undefined)

    const response = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(401)
  })

  it('returns 500 when the logout transaction fails', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.query.activeTokens.findFirst).mockResolvedValueOnce(ACTIVE_TOKEN_ENTRY as never)
    vi.mocked(db.transaction).mockRejectedValueOnce(new Error('DB error'))

    const response = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(500)
  })
})

describe('POST /v1/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with generic message for a registered email user', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      }),
    } as never)

    const response = await app.request('/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    const body = await response.json() as { message: string; password_reset_token?: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('If this email is registered, a reset link has been sent')
    expect(body.password_reset_token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('does not include password_reset_token when the email is unknown', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await app.request('/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.com' }),
    })

    const body = await response.json() as { message: string; password_reset_token?: string }
    expect(response.status).toBe(200)
    expect(body.password_reset_token).toBeUndefined()
  })

  it('does not leak password_reset_token in production', async () => {
    const originalEnv = env.NODE_ENV
    env.NODE_ENV = NodeEnvs.PRODUCTION
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      }),
    } as never)

    try {
      const response = await app.request('/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      })

      const body = await response.json() as { message: string; password_reset_token?: string }
      expect(response.status).toBe(200)
      expect(body.password_reset_token).toBeUndefined()
    } finally {
      env.NODE_ENV = originalEnv
    }
  })

  it('returns 200 with generic message when email is unknown', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await app.request('/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.com' }),
    })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('If this email is registered, a reset link has been sent')
  })

  it('returns 200 silently for an OAuth user with no password', async () => {
    const oauthUser = { ...VALID_USER, passwordHash: null }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(oauthUser)

    const response = await app.request('/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    expect(response.status).toBe(200)
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })

  it('returns 422 when email is malformed', async () => {
    const response = await app.request('/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when email is missing', async () => {
    const response = await app.request('/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /v1/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 and resets password when token is valid', async () => {
    const userWithResetToken = {
      ...VALID_USER,
      passwordResetToken: 'some-hash',
      passwordResetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithResetToken)
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never)
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    } as never)

    const response = await app.request('/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password_reset_token: 'valid-raw-token-64-chars-long-at-least-to-pass', password: 'newpassword123' }),
    })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('Password reset successfully')
  })

  it('returns 400 when token does not match any user', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await app.request('/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password_reset_token: 'invalid-token', password: 'newpassword123' }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 400 when token is expired', async () => {
    const userWithExpiredToken = {
      ...VALID_USER,
      passwordResetToken: 'some-hash',
      passwordResetTokenExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
    }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithExpiredToken)

    const response = await app.request('/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password_reset_token: 'expired-token', password: 'newpassword123' }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 400 when user has no reset token set', async () => {
    const userWithNoToken = { ...VALID_USER, passwordResetToken: null, passwordResetTokenExpiresAt: null }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithNoToken)

    const response = await app.request('/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password_reset_token: 'some-token', password: 'newpassword123' }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 422 when password is too short', async () => {
    const response = await app.request('/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password_reset_token: 'some-token', password: 'short' }),
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when password is missing', async () => {
    const response = await app.request('/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password_reset_token: 'some-token' }),
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when password_reset_token is missing', async () => {
    const response = await app.request('/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'newpassword123' }),
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /v1/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with a new accessToken and a rotated refreshToken inside a single transaction', async () => {
    const submittedRefreshToken = 'some-valid-raw-token'
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(VALID_REFRESH_TOKEN_ROW as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)

    const response = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: submittedRefreshToken }),
    })

    const body = await response.json() as { accessToken: string; refreshToken: string }
    expect(response.status).toBe(200)
    expect(typeof body.accessToken).toBe('string')
    expect(body.accessToken.length).toBeGreaterThan(0)
    expect(body.refreshToken).not.toBe(submittedRefreshToken)
    expect(body.refreshToken).toMatch(/^[a-f0-9]{64}$/)
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
  })

  it('returns 401 when refreshToken is not found', async () => {
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(undefined)

    const response = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'unknown-token' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when refreshToken is revoked', async () => {
    const revokedToken = { ...VALID_REFRESH_TOKEN_ROW, revokedAt: new Date('2024-01-01') }
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(revokedToken as never)

    const response = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'revoked-token' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when refreshToken is expired', async () => {
    const expiredToken = { ...VALID_REFRESH_TOKEN_ROW, expiresAt: new Date(Date.now() - 1000) }
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(expiredToken as never)

    const response = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'expired-token' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when user is soft-deleted', async () => {
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(VALID_REFRESH_TOKEN_ROW as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...VALID_USER, deletedAt: new Date('2024-01-01') })

    const response = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'some-token' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 403 when user is banned', async () => {
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(VALID_REFRESH_TOKEN_ROW as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...VALID_USER, bannedAt: new Date('2024-01-01') })

    const response = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'some-token' }),
    })

    expect(response.status).toBe(403)
  })

  it('returns 422 when refreshToken field is missing', async () => {
    const response = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(422)
  })
})
