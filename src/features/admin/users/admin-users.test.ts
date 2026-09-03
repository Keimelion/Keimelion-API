import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'
import { db } from '../../../db/client.js'
import { apiRequest } from '../../../shared/test/api-request.js'

const TEST_JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'

const ADMIN_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@example.com',
  username: 'adminuser',
  passwordHash: 'hashed',
  authProvider: 'email' as const,
  role: 'admin' as const,
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

const TARGET_USER = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'user@example.com',
  username: 'regularuser',
  passwordHash: 'hashed',
  authProvider: 'email' as const,
  role: 'user' as const,
  avatarUrl: null,
  isCgvAccepted: true,
  cgvAcceptedAt: new Date('2024-01-01'),
  isMarketingOptedIn: false,
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  emailVerifiedAt: null,
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
const ACCESS_TOKEN_ENTRY = { tokenId: TEST_JTI, userId: ADMIN_USER.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }

async function generateTestToken(userId: string, role = 'user'): Promise<string> {
  const secret = new TextEncoder().encode(TEST_JWT_SECRET)
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setJti(TEST_JTI)
    .sign(secret)
}

describe('GET /v1/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated users list when admin is authenticated', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findMany).mockResolvedValueOnce([ADMIN_USER, TARGET_USER])
    vi.mocked(db.select).mockReturnValueOnce({ from: vi.fn().mockResolvedValueOnce([{ count: 2 }]) } as never)

    const response = await apiRequest('/v1/admin/users', { token })

    const body = await response.json() as { items: { email: string }[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.email).toBe('admin@example.com')
    expect(body.pagination.total).toBe(2)
  })

  it('returns 200 including soft-deleted users', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    const deletedUser = { ...TARGET_USER, deletedAt: new Date('2024-06-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findMany).mockResolvedValueOnce([ADMIN_USER, deletedUser])
    vi.mocked(db.select).mockReturnValueOnce({ from: vi.fn().mockResolvedValueOnce([{ count: 2 }]) } as never)

    const response = await apiRequest('/v1/admin/users', { token })

    const body = await response.json() as { items: { deletedAt: string | null }[] }
    expect(response.status).toBe(200)
    expect(body.items[1]?.deletedAt).not.toBeNull()
  })

  it('returns 422 when page is less than 1', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?page=0', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when limit exceeds 100', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?limit=101', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when page is not an integer', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?page=1.5', { token })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(TARGET_USER.id, 'user')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest('/v1/admin/users', { token })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest('/v1/admin/users')
    expect(response.status).toBe(401)
  })

  it('returns 401 when JWT is invalid', async () => {
    const response = await apiRequest('/v1/admin/users', { token: 'invalidtoken' })
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with admin user when id is valid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { token })

    const body = await response.json() as { user: { email: string } }
    expect(response.status).toBe(200)
    expect(body.user.email).toBe('user@example.com')
  })

  it('returns 200 including soft-deleted user', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    const deletedUser = { ...TARGET_USER, deletedAt: new Date('2024-06-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(deletedUser)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { token })

    const body = await response.json() as { user: { deletedAt: string | null } }
    expect(response.status).toBe(200)
    expect(body.user.deletedAt).not.toBeNull()
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users/not-a-uuid', { token })

    expect(response.status).toBe(422)
  })

  it('returns 404 when user is not found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { token })

    expect(response.status).toBe(404)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(TARGET_USER.id, 'user')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { token })

    expect(response.status).toBe(403)
  })
})

describe('PATCH /v1/admin/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with updated user when body is valid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    const updatedUser = { ...TARGET_USER, role: 'moderator' as const }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([updatedUser]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'moderator' },
    })

    const body = await response.json() as { user: { role: string } }
    expect(response.status).toBe(200)
    expect(body.user.role).toBe('moderator')
  })

  it('returns 422 when avatar_url is not a valid URL', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { avatarUrl: 'not-a-url' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when role is not a valid enum value', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'superuser' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 404 when target user is not found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'moderator' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 403 when admin tries to update themselves', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest(`/v1/admin/users/${ADMIN_USER.id}`, {
      method: 'PATCH',
      token,
      body: { avatarUrl: 'https://example.com/avatar.png' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 500 when update query returns empty result', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'moderator' },
    })

    expect(response.status).toBe(500)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(TARGET_USER.id, 'user')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'moderator' },
    })

    expect(response.status).toBe(403)
  })

  it('silently strips password fields from the body — password is never touched', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    const updatedUser = { ...TARGET_USER, role: 'moderator' as const }
    const setMock = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([updatedUser]),
      }),
    })

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.update).mockReturnValueOnce({ set: setMock } as never)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: {
        role: 'moderator',
        password: 'evil-plaintext',
        passwordHash: 'evil-hash',
        email: 'takeover@example.com',
        bannedAt: null,
      },
    })

    expect(response.status).toBe(200)
    expect(setMock).toHaveBeenCalledOnce()
    const setArgs = setMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArgs).not.toHaveProperty('password')
    expect(setArgs).not.toHaveProperty('passwordHash')
    expect(setArgs).not.toHaveProperty('email')
    expect(setArgs).not.toHaveProperty('bannedAt')
  })
})

describe('DELETE /v1/admin/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 and soft-deletes the user', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    const deletedUser = { ...TARGET_USER, deletedAt: new Date() }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([deletedUser]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { method: 'DELETE', token })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('User deleted successfully')
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users/not-a-uuid', { method: 'DELETE', token })

    expect(response.status).toBe(422)
  })

  it('returns 404 when target user is not found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { method: 'DELETE', token })

    expect(response.status).toBe(404)
  })

  it('returns 403 when admin tries to delete themselves', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest(`/v1/admin/users/${ADMIN_USER.id}`, { method: 'DELETE', token })

    expect(response.status).toBe(403)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(TARGET_USER.id, 'user')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { method: 'DELETE', token })

    expect(response.status).toBe(403)
  })
})
