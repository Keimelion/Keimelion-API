import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'

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
  passwordResetToken: null,
  passwordResetTokenExpiresAt: null,
  lastActiveAt: null,
  deletedAt: null,
  bannedAt: null,
  banReason: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const TEST_JTI = '00000000-0000-0000-0000-000000000099'
const ACCESS_TOKEN_ENTRY = { tokenId: TEST_JTI, userId: SAFE_USER.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }

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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with user profile when authenticated', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)

    const response = await apiRequest('/v1/users/me', { token })

    const body = await response.json() as { user: { email: string } }
    expect(response.status).toBe(200)
    expect(body.user.email).toBe('user@example.com')
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest('/v1/users/me')
    expect(response.status).toBe(401)
  })

  it('returns 401 when JWT is expired or invalid', async () => {
    const response = await apiRequest('/v1/users/me', { token: 'invalidtoken' })
    expect(response.status).toBe(401)
  })

  it('returns 401 when user is deleted', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    const deletedUser = { ...SAFE_USER, deletedAt: new Date('2024-01-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(deletedUser)

    const response = await apiRequest('/v1/users/me', { token })

    expect(response.status).toBe(401)
  })

  it('returns 403 when user is banned', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    const bannedUser = { ...SAFE_USER, bannedAt: new Date('2024-01-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(bannedUser)

    const response = await apiRequest('/v1/users/me', { token })

    expect(response.status).toBe(403)
  })
})

describe('PATCH /v1/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
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

    const response = await apiRequest('/v1/users/me', {
      method: 'PATCH',
      token,
      body: { username: 'newusername' },
    })

    const body = await response.json() as { user: { username: string } }
    expect(response.status).toBe(200)
    expect(body.user.username).toBe('newusername')
  })

  it('returns 422 when avatar_url is not a valid URL', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)

    const response = await apiRequest('/v1/users/me', {
      method: 'PATCH',
      token,
      body: { avatarUrl: 'not-a-url' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when username contains invalid characters', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)

    const response = await apiRequest('/v1/users/me', {
      method: 'PATCH',
      token,
      body: { username: 'invalid username@' },
    })

    expect(response.status).toBe(422)
  })

  it('silently strips password fields from the body — password is never touched', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    const updatedUser = { ...SAFE_USER, username: 'legit' }
    const setMock = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([updatedUser]),
      }),
    })

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)
    vi.mocked(db.update).mockReturnValueOnce({ set: setMock } as never)

    const response = await apiRequest('/v1/users/me', {
      method: 'PATCH',
      token,
      body: {
        username: 'legit',
        password: 'evil-plaintext',
        passwordHash: 'evil-hash',
        role: 'admin',
        bannedAt: null,
      },
    })

    expect(response.status).toBe(200)
    expect(setMock).toHaveBeenCalledOnce()
    const setArgs = setMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArgs).not.toHaveProperty('password')
    expect(setArgs).not.toHaveProperty('passwordHash')
    expect(setArgs).not.toHaveProperty('role')
    expect(setArgs).not.toHaveProperty('bannedAt')
  })
})

describe('POST /v1/users/me/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with message and revokes all tokens when current password is correct', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('OldPassword1', 4)
    const token = await generateTestToken(SAFE_USER.id)
    const userWithHash = { ...SAFE_USER, passwordHash: hash }

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithHash)

    const response = await apiRequest('/v1/users/me/change-password', {
      method: 'POST',
      token,
      body: { currentPassword: 'OldPassword1', newPassword: 'NewPassword9' },
    })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('Password changed successfully')
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest('/v1/users/me/change-password', {
      method: 'POST',
      body: { currentPassword: 'OldPassword1', newPassword: 'NewPassword9' },
    })

    expect(response.status).toBe(401)
  })

  it('returns 422 when currentPassword is missing', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)

    const response = await apiRequest('/v1/users/me/change-password', {
      method: 'POST',
      token,
      body: { newPassword: 'NewPassword9' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when newPassword is missing', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)

    const response = await apiRequest('/v1/users/me/change-password', {
      method: 'POST',
      token,
      body: { currentPassword: 'OldPassword1' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when newPassword is the same as currentPassword', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)

    const response = await apiRequest('/v1/users/me/change-password', {
      method: 'POST',
      token,
      body: { currentPassword: 'SamePassword1', newPassword: 'SamePassword1' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 400 with INVALID_CREDENTIALS when currentPassword does not match', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('OldPassword1', 4)
    const token = await generateTestToken(SAFE_USER.id)
    const userWithHash = { ...SAFE_USER, passwordHash: hash }

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithHash)

    const response = await apiRequest('/v1/users/me/change-password', {
      method: 'POST',
      token,
      body: { currentPassword: 'WrongPassword1', newPassword: 'NewPassword9' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(400)
    expect(body.code).toBe('INVALID_CREDENTIALS')
  })

  it('returns 400 with INVALID_OPERATION when user has no password (OAuth user)', async () => {
    const token = await generateTestToken(SAFE_USER.id)
    const oauthUser = { ...SAFE_USER, passwordHash: null }

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(SAFE_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(oauthUser)

    const response = await apiRequest('/v1/users/me/change-password', {
      method: 'POST',
      token,
      body: { currentPassword: 'OldPassword1', newPassword: 'NewPassword9' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(400)
    expect(body.code).toBe('INVALID_OPERATION')
  })
})

describe('DELETE /v1/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
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

    const response = await apiRequest('/v1/users/me', { method: 'DELETE', token })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('Account deleted successfully')
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/users/me', { method: 'DELETE' })
    expect(response.status).toBe(401)
  })
})
