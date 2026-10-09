import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../../db/client.js'
import { apiRequest } from '../../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../../shared/test/auth.js'
import { logger } from '../../../shared/utils/logger.js'

vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

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

const NON_ADMIN_USER = {
  ...ADMIN_USER,
  id: '00000000-0000-0000-0000-000000000002',
  email: 'user@example.com',
  role: 'user' as const,
}

const TAG_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'gaming',
  slug: 'gaming',
  createdByUserId: ADMIN_USER.id,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(ADMIN_USER.id)

function mockAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER as never)
}

function mockNonAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(
    makeAccessTokenEntry(NON_ADMIN_USER.id) as never,
  )
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(NON_ADMIN_USER as never)
}

function mockFindTagById(row: unknown): void {
  vi.mocked(db.query.tags.findFirst).mockResolvedValueOnce(row as never)
}

function mockInsertTag(returnRow: unknown): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    }),
  } as never)
}

function mockUpdateTag(returnRow: unknown): void {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([returnRow]),
      }),
    }),
  } as never)
}

function mockUpdateTagUniqueViolation(): void {
  const error = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
  })
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockRejectedValueOnce(error),
      }),
    }),
  } as never)
}

function mockDeleteTag(returnRow: unknown): void {
  vi.mocked(db.delete).mockReturnValueOnce({
    where: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    }),
  } as never)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

describe('POST /v1/admin/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 201 with created tag (name is normalized to slug)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertTag(TAG_ROW)

    const response = await apiRequest('/v1/admin/tags', {
      method: 'POST',
      token,
      body: { name: 'Gaming' },
    })

    const body = await response.json() as { tag: { slug: string; name: string } }
    expect(response.status).toBe(201)
    expect(body.tag.slug).toBe('gaming')
    expect(body.tag.name).toBe('gaming')
  })

  it('returns 422 TAG_INVALID_NAME when normalized slug is empty', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/tags', {
      method: 'POST',
      token,
      body: { name: '!!!' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('TAG_INVALID_NAME')
  })

  it('returns 422 when name is empty', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/tags', {
      method: 'POST',
      token,
      body: { name: '' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 on unknown field (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/tags', {
      method: 'POST',
      token,
      body: { name: 'ok', unknownField: 'nope' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/tags', {
      method: 'POST',
      token,
      body: { name: 'gaming' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/admin/tags', {
      method: 'POST',
      body: { name: 'gaming' },
    })

    expect(response.status).toBe(401)
  })

  it('logs at info level on successful creation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertTag(TAG_ROW)

    await apiRequest('/v1/admin/tags', {
      method: 'POST',
      token,
      body: { name: 'Gaming' },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_tag', slug: 'gaming' }),
    )
  })
})

describe('GET /v1/admin/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated tags', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.tags.findMany).mockResolvedValueOnce([TAG_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/tags', { token })

    const body = await response.json() as {
      items: { slug: string }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.items[0]?.slug).toBe('gaming')
  })

  it('returns 422 when sort field is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/tags?sort=unknown:asc', { token })

    expect(response.status).toBe(422)
  })

  it('accepts createdByUserId[isNull]=true filter', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.tags.findMany).mockResolvedValueOnce([TAG_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/tags?createdByUserId%5BisNull%5D=true', { token })

    expect(response.status).toBe(200)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/tags', { token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/admin/tags')
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/tags/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with tag when found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(TAG_ROW)

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, { token })

    const body = await response.json() as { tag: { id: string } }
    expect(response.status).toBe(200)
    expect(body.tag.id).toBe(TAG_ROW.id)
  })

  it('returns 404 TAG_NOT_FOUND when tag does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(undefined)

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, { token })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('TAG_NOT_FOUND')
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/tags/not-a-uuid', { token })
    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`)
    expect(response.status).toBe(401)
  })
})

describe('PATCH /v1/admin/tags/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 when renaming via name (normalizes to slug)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(TAG_ROW)
    mockUpdateTag({ ...TAG_ROW, name: 'video-games', slug: 'video-games' })

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Video Games' },
    })

    const body = await response.json() as { tag: { slug: string; name: string } }
    expect(response.status).toBe(200)
    expect(body.tag.slug).toBe('video-games')
    expect(body.tag.name).toBe('video-games')
  })

  it('returns 200 when renaming via explicit slug', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(TAG_ROW)
    mockUpdateTag({ ...TAG_ROW, name: 'video-games', slug: 'video-games' })

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { slug: 'video-games' },
    })

    const body = await response.json() as { tag: { slug: string } }
    expect(response.status).toBe(200)
    expect(body.tag.slug).toBe('video-games')
  })

  it('returns 200 unchanged when body is empty', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(TAG_ROW)

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'PATCH',
      token,
      body: {},
    })

    const body = await response.json() as { tag: { slug: string } }
    expect(response.status).toBe(200)
    expect(body.tag.slug).toBe('gaming')
  })

  it('returns 409 CONFLICT when slug rename collides', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(TAG_ROW)
    mockUpdateTagUniqueViolation()

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { slug: 'existing' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
  })

  it('returns 404 TAG_NOT_FOUND when tag does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(undefined)

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'anything' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('TAG_NOT_FOUND')
  })

  it('returns 422 TAG_INVALID_NAME when normalized name is empty', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(TAG_ROW)

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: '!!!' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('TAG_INVALID_NAME')
  })

  it('returns 422 when slug fails kebab-case validation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { slug: 'Bad Slug!' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 on unknown field (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { unknownField: 'value' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'X' },
    })

    expect(response.status).toBe(403)
  })
})

describe('DELETE /v1/admin/tags/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 204 and deletes the tag', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(TAG_ROW)
    mockDeleteTag(TAG_ROW)

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(204)
  })

  it('returns 404 TAG_NOT_FOUND when tag does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(undefined)

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('TAG_NOT_FOUND')
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/tags/not-a-uuid', {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, { method: 'DELETE' })
    expect(response.status).toBe(401)
  })

  it('logs at warn level on successful delete', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindTagById(TAG_ROW)
    mockDeleteTag(TAG_ROW)

    await apiRequest(`/v1/admin/tags/${TAG_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_delete_tag', slug: 'gaming' }),
    )
  })
})
