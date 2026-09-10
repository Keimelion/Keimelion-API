import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'
import { db } from '../../../db/client.js'
import { apiRequest } from '../../../shared/test/api-request.js'
import { logger } from '../../../shared/utils/logger.js'

vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

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

function mockSelectChain(rows: unknown[]): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValueOnce(rows),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

describe('GET /v1/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated users list when admin is authenticated', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([ADMIN_USER, TARGET_USER])
    mockCountChain(2)

    const response = await apiRequest('/v1/admin/users', { token })

    const body = await response.json() as { items: { email: string }[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.email).toBe('admin@example.com')
    expect(body.pagination.total).toBe(2)
  })

  it('hides soft-deleted users by default', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([ADMIN_USER])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/users', { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('returns soft-deleted users when isDeleted=true', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    const deletedUser = { ...TARGET_USER, deletedAt: new Date('2024-06-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([deletedUser])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/users?isDeleted=true', { token })

    const body = await response.json() as { items: { deletedAt: string | null }[] }
    expect(response.status).toBe(200)
    expect(body.items[0]?.deletedAt).not.toBeNull()
  })

  it('returns empty result set when no users match filters', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([])
    mockCountChain(0)

    const response = await apiRequest('/v1/admin/users?email=nomatch', { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number; totalPages: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
    expect(body.pagination.totalPages).toBe(0)
  })

  it('filters by email substring', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([ADMIN_USER])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/users?email=admin', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { email: string }[] }
    expect(body.items[0]?.email).toBe('admin@example.com')
  })

  it('filters by username substring', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([TARGET_USER])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/users?username=regular', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { username: string }[] }
    expect(body.items[0]?.username).toBe('regularuser')
  })

  it('filters by role', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([ADMIN_USER])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/users?role=admin', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { pagination: { total: number } }
    expect(body.pagination.total).toBe(1)
  })

  it('filters by isBanned=true returns only banned users', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    const bannedUser = { ...TARGET_USER, bannedAt: new Date('2024-03-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([bannedUser])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/users?isBanned=true', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { bannedAt: string | null }[] }
    expect(body.items[0]?.bannedAt).not.toBeNull()
  })

  it('filters by isBanned=false returns only non-banned users', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([ADMIN_USER, TARGET_USER])
    mockCountChain(2)

    const response = await apiRequest('/v1/admin/users?isBanned=false', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { bannedAt: string | null }[] }
    expect(body.items.every((item) => item.bannedAt === null)).toBe(true)
  })

  it('applies createdFrom and createdTo date filters', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([ADMIN_USER])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/users?createdFrom=2024-01-01T00:00:00Z&createdTo=2024-12-31T23:59:59Z', { token })

    expect(response.status).toBe(200)
  })

  it('applies sort param and returns 200', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([ADMIN_USER, TARGET_USER])
    mockCountChain(2)

    const response = await apiRequest('/v1/admin/users?sort=email:asc', { token })

    expect(response.status).toBe(200)
  })

  it('applies combined filters', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([ADMIN_USER])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/users?role=admin&isBanned=false&sort=email:asc&page=1&limit=50', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { pagination: { page: number; limit: number } }
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(50)
  })

  it('total reflects filtered count (regression guard)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([ADMIN_USER])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/users?role=admin', { token })

    const body = await response.json() as { pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.pagination.total).toBe(1)
  })

  it('sensitive fields are never present in admin user response', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockSelectChain([ADMIN_USER])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/users', { token })

    const body = await response.json() as { items: Record<string, unknown>[] }
    expect(response.status).toBe(200)
    const item = body.items[0]
    expect(item).not.toHaveProperty('passwordHash')
    expect(item).not.toHaveProperty('emailVerifyToken')
    expect(item).not.toHaveProperty('emailVerifyTokenExpiresAt')
    expect(item).not.toHaveProperty('passwordResetToken')
    expect(item).not.toHaveProperty('passwordResetTokenExpiresAt')
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

  it('returns 422 when sort field is not in whitelist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?sort=passwordHash:asc', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when sort is missing direction', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?sort=createdAt', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when sort direction is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?sort=createdAt:sideways', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when role is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?role=superuser', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when isBanned uses non-literal value', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?isBanned=1', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when isBanned=yes', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?isBanned=yes', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when email is empty string', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?email=', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when email exceeds 320 characters', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    const longEmail = 'a'.repeat(321)

    const response = await apiRequest(`/v1/admin/users?email=${longEmail}`, { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when createdFrom is not a valid date', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?createdFrom=not-a-date', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when createdFrom is after createdTo', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?createdFrom=2024-12-31T00:00:00Z&createdTo=2024-01-01T00:00:00Z', { token })

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

describe('POST /v1/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  function mockInsertUser(): void {
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([TARGET_USER]),
      }),
    } as never)
  }

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest('/v1/admin/users', { method: 'POST', body: { email: 'new@example.com', role: 'user' } })
    expect(response.status).toBe(401)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(TARGET_USER.id, 'user')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'user' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 422 when role is missing', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when role is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'superuser' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when email is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'not-an-email', role: 'user' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when username does not match the regex', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', username: 'bad username!', role: 'user' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when an unknown key is provided (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'user', unknownField: 'value' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when password key is provided (strict schema rejects it)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'user', password: 'somepassword' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 201 with user and passwordResetToken in non-production', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator' },
    })

    const body = await response.json() as { user: Record<string, unknown>; passwordResetToken: string }
    expect(response.status).toBe(201)
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe('user@example.com')
    expect(body.passwordResetToken).toBeDefined()
    expect(typeof body.passwordResetToken).toBe('string')
  })

  it('response body does not expose sensitive fields', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator' },
    })

    const body = await response.json() as { user: Record<string, unknown> }
    expect(response.status).toBe(201)
    expect(body.user).not.toHaveProperty('passwordHash')
    expect(body.user).not.toHaveProperty('passwordResetToken')
    expect(body.user).not.toHaveProperty('emailVerifyToken')
  })

  it('logs at warn level for privileged role (moderator)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()

    await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator' },
    })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledOnce()
    expect(vi.mocked(logger.info)).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_user' }),
    )
  })

  it('logs at warn level for privileged role (admin)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()

    await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'admin' },
    })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledOnce()
  })

  it('logs at info level for non-privileged role (user)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()

    await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'user' },
    })

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_user', role: 'user' }),
    )
  })

  it('calls db.insert with expected explicit values', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const valuesMock = vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([TARGET_USER]),
    })
    vi.mocked(db.insert).mockReturnValueOnce({ values: valuesMock } as never)

    await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'user' },
    })

    expect(valuesMock).toHaveBeenCalledOnce()
    const insertedFields = valuesMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insertedFields.isCgvAccepted).toBe(false)
    expect(insertedFields.isMarketingOptedIn).toBe(false)
    expect(insertedFields.cgvAcceptedAt).toBeNull()
    expect(insertedFields.emailVerifyToken).toBeNull()
    expect(insertedFields.emailVerifyTokenExpiresAt).toBeNull()
    expect(insertedFields.emailVerifiedAt).toBeInstanceOf(Date)
    expect(insertedFields.authProvider).toBe('email')
    expect(insertedFields.passwordResetToken).toBeDefined()
    expect(insertedFields.passwordResetTokenExpiresAt).toBeInstanceOf(Date)
  })

  it('returns 409 when insert hits the unique constraint', async () => {
    const token = await generateTestToken(ADMIN_USER.id, 'admin')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    class PgUniqueError extends Error {
      code = '23505'
    }

    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockRejectedValueOnce(new PgUniqueError('unique violation')),
      }),
    } as never)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'user' },
    })

    expect(response.status).toBe(409)
  })
})
