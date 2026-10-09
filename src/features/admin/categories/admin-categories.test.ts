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

const ROOT_CATEGORY = {
  id: '00000000-0000-0000-0000-000000000010',
  parentId: null,
  name: 'Électronique',
  slug: 'electronique',
  depth: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const CHILD_CATEGORY = {
  ...ROOT_CATEGORY,
  id: '00000000-0000-0000-0000-000000000011',
  parentId: ROOT_CATEGORY.id,
  name: 'Smartphones',
  slug: 'smartphones',
  depth: 1,
}

const GRANDCHILD_CATEGORY = {
  ...ROOT_CATEGORY,
  id: '00000000-0000-0000-0000-000000000012',
  parentId: CHILD_CATEGORY.id,
  name: 'Android',
  slug: 'android',
  depth: 2,
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

function mockFindCategoryById(row: unknown): void {
  vi.mocked(db.query.categories.findFirst).mockResolvedValueOnce(row as never)
}

function mockInsertCategory(returnRow: unknown): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    }),
  } as never)
}

function mockInsertCategoryUniqueViolation(): void {
  const error = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
  })
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockRejectedValueOnce(error),
    }),
  } as never)
}

function mockUpdateCategory(returnRow: unknown): void {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([returnRow]),
      }),
    }),
  } as never)
}

function mockUpdateCategoryUniqueViolation(): void {
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

function mockDeleteCategory(returnRow: unknown): void {
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

describe('POST /v1/admin/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 201 with created root category', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertCategory(ROOT_CATEGORY)

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: 'Électronique', slug: 'electronique' },
    })

    const body = await response.json() as { category: { slug: string; depth: number; parentId: string | null } }
    expect(response.status).toBe(201)
    expect(body.category.slug).toBe('electronique')
    expect(body.category.depth).toBe(0)
    expect(body.category.parentId).toBeNull()
  })

  it('returns 201 with child category whose depth is parent.depth + 1', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockInsertCategory(CHILD_CATEGORY)

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: 'Smartphones', slug: 'smartphones', parentId: ROOT_CATEGORY.id },
    })

    const body = await response.json() as { category: { depth: number; parentId: string } }
    expect(response.status).toBe(201)
    expect(body.category.depth).toBe(1)
    expect(body.category.parentId).toBe(ROOT_CATEGORY.id)
  })

  it('returns 404 with CATEGORY_NOT_FOUND when parent does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(undefined)

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: {
        name: 'Orphan',
        slug: 'orphan',
        parentId: '00000000-0000-0000-0000-0000000000ff',
      },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
  })

  it('returns 422 with CATEGORY_MAX_DEPTH_EXCEEDED when parent is at depth 2', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(GRANDCHILD_CATEGORY)

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: {
        name: 'Too deep',
        slug: 'too-deep',
        parentId: GRANDCHILD_CATEGORY.id,
      },
    })

    const body = await response.json() as { code: string; message: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('CATEGORY_MAX_DEPTH_EXCEEDED')
    expect(body.message).toContain('3 levels')
  })

  it('returns 409 with CATEGORY_SLUG_CONFLICT when slug already exists', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertCategoryUniqueViolation()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: 'Duplicate', slug: 'duplicate' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CATEGORY_SLUG_CONFLICT')
  })

  it('returns 422 when slug fails kebab-case validation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: 'Bad slug', slug: 'Bad Slug!' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when name is empty', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: '', slug: 'ok' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when parentId is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: 'Bad parent', slug: 'bad-parent', parentId: 'not-a-uuid' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 on unknown field (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: 'X', slug: 'x', unknownField: 'nope' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: 'Nope', slug: 'nope' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      body: { name: 'X', slug: 'x' },
    })

    expect(response.status).toBe(401)
  })

  it('logs at info level on successful creation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertCategory(ROOT_CATEGORY)

    await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: 'Électronique', slug: 'electronique' },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_category', slug: 'electronique' }),
    )
  })
})

describe('GET /v1/admin/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated categories', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([ROOT_CATEGORY] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/categories', { token })

    const body = await response.json() as {
      items: { slug: string }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.items[0]?.slug).toBe('electronique')
  })

  it('returns 422 when sort field is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories?sort=unknown:asc', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when bracket-syntax uses an unknown field', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories?unknownField%5Beq%5D=foo', { token })

    expect(response.status).toBe(422)
  })

  it('accepts parentId[isNull]=true filter', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([ROOT_CATEGORY] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/categories?parentId%5BisNull%5D=true', { token })

    expect(response.status).toBe(200)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/categories', { token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/admin/categories')
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/categories/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with category when found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, { token })

    const body = await response.json() as { category: { id: string } }
    expect(response.status).toBe(200)
    expect(body.category.id).toBe(ROOT_CATEGORY.id)
  })

  it('returns 404 with CATEGORY_NOT_FOUND when category does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(undefined)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, { token })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories/not-a-uuid', { token })
    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`)
    expect(response.status).toBe(401)
  })
})

describe('PATCH /v1/admin/categories/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 when patching only the name (no parent change)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockUpdateCategory({ ...ROOT_CATEGORY, name: 'Électronique updated' })

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Électronique updated' },
    })

    const body = await response.json() as { category: { name: string } }
    expect(response.status).toBe(200)
    expect(body.category.name).toBe('Électronique updated')
  })

  it('returns 404 when category not found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(undefined)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Nope' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 409 CATEGORY_SLUG_CONFLICT when patching slug collides', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockUpdateCategoryUniqueViolation()

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { slug: 'duplicate' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CATEGORY_SLUG_CONFLICT')
  })

  it('returns 422 CATEGORY_CYCLE_DETECTED when parentId equals the id itself', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { parentId: ROOT_CATEGORY.id },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('CATEGORY_CYCLE_DETECTED')
  })

  it('returns 422 CATEGORY_CYCLE_DETECTED when parentId is a descendant', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockFindCategoryById(CHILD_CATEGORY)
    mockFindCategoryById(ROOT_CATEGORY)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { parentId: CHILD_CATEGORY.id },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('CATEGORY_CYCLE_DETECTED')
  })

  it('returns 404 CATEGORY_NOT_FOUND when new parent does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockFindCategoryById(undefined)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { parentId: '00000000-0000-0000-0000-0000000000ff' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories/not-a-uuid', {
      method: 'PATCH',
      token,
      body: { name: 'X' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 on unknown field (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { unknownField: 'value' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'X' },
    })

    expect(response.status).toBe(403)
  })
})

describe('DELETE /v1/admin/categories/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 204 and deletes the category', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockDeleteCategory(ROOT_CATEGORY)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(204)
  })

  it('returns 404 CATEGORY_NOT_FOUND when category does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(undefined)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'DELETE',
      token,
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories/not-a-uuid', {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'DELETE',
    })
    expect(response.status).toBe(401)
  })

  it('logs at warn level on successful delete', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockDeleteCategory(ROOT_CATEGORY)

    await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'DELETE',
      token,
    })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_delete_category', slug: 'electronique' }),
    )
  })
})
