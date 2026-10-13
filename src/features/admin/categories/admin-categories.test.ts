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
  slug: 'electronics',
  depth: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const ROOT_CATEGORY_TRANSLATIONS = [
  { categoryId: ROOT_CATEGORY.id, locale: 'fr' as const, name: 'Électronique' },
  { categoryId: ROOT_CATEGORY.id, locale: 'en' as const, name: 'Electronics' },
]

const ROOT_CATEGORY_WITH_TRANSLATIONS = {
  ...ROOT_CATEGORY,
  translations: ROOT_CATEGORY_TRANSLATIONS,
}

const CHILD_CATEGORY = {
  ...ROOT_CATEGORY,
  id: '00000000-0000-0000-0000-000000000011',
  parentId: ROOT_CATEGORY.id,
  slug: 'smartphones',
  depth: 1,
}

const CHILD_CATEGORY_WITH_TRANSLATIONS = {
  ...CHILD_CATEGORY,
  translations: [
    { categoryId: CHILD_CATEGORY.id, locale: 'fr' as const, name: 'Téléphones' },
    { categoryId: CHILD_CATEGORY.id, locale: 'en' as const, name: 'Smartphones' },
  ],
}

const GRANDCHILD_CATEGORY = {
  ...ROOT_CATEGORY,
  id: '00000000-0000-0000-0000-000000000012',
  parentId: CHILD_CATEGORY.id,
  slug: 'android',
  depth: 2,
}

const GRANDCHILD_CATEGORY_WITH_TRANSLATIONS = {
  ...GRANDCHILD_CATEGORY,
  translations: [
    { categoryId: GRANDCHILD_CATEGORY.id, locale: 'en' as const, name: 'Android' },
  ],
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

function buildInsertCategoryChain(returnRow: unknown): unknown {
  return {
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    }),
  }
}

function buildInsertTranslationChain(): unknown {
  return {
    values: vi.fn().mockReturnValueOnce({
      onConflictDoUpdate: vi.fn().mockResolvedValueOnce([]),
    }),
  }
}

function mockInsertCategoryTransaction(returnRow: unknown): void {
  vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
    const tx = {
      insert: vi
        .fn()
        .mockReturnValueOnce(buildInsertCategoryChain(returnRow))
        .mockReturnValueOnce(buildInsertTranslationChain())
        .mockReturnValueOnce(buildInsertTranslationChain()),
    }
    return callback(tx as never)
  })
}

function mockInsertCategoryTransactionUniqueViolation(): void {
  const error = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
  })
  vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
    const tx = {
      insert: vi.fn().mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(error),
        }),
      }),
    }
    return callback(tx as never)
  })
}

function mockUpdateTransaction(options: {
  updatedRow?: unknown
  translationUpserts?: number
  findInsideTx?: unknown
}): void {
  vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
    const upsertCount = options.translationUpserts ?? 0
    const insertMock = vi.fn()
    for (let i = 0; i < upsertCount; i++) {
      insertMock.mockReturnValueOnce(buildInsertTranslationChain())
    }

    const updateMock = options.updatedRow === undefined
      ? vi.fn()
      : vi.fn().mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([options.updatedRow]),
            }),
          }),
        })

    const tx = {
      insert: insertMock,
      update: updateMock,
      query: {
        categories: {
          findFirst: vi.fn().mockResolvedValueOnce(options.findInsideTx),
        },
      },
    }
    return callback(tx as never)
  })
}

function mockUpdateTransactionUniqueViolation(): void {
  const error = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
  })
  vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
    const tx = {
      insert: vi.fn(),
      update: vi.fn().mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockRejectedValueOnce(error),
          }),
        }),
      }),
      query: {
        categories: {
          findFirst: vi.fn(),
        },
      },
    }
    return callback(tx as never)
  })
}

function mockDeleteCategory(returnRow: unknown): void {
  vi.mocked(db.delete).mockReturnValueOnce({
    where: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    }),
  } as never)
}

function mockFindCategoryByIdWithTranslations(row: unknown): void {
  vi.mocked(db.query.categories.findFirst).mockResolvedValueOnce(row as never)
}

describe('POST /v1/admin/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 201 with created root category including translations dict', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertCategoryTransaction(ROOT_CATEGORY)
    mockFindCategoryByIdWithTranslations(ROOT_CATEGORY_WITH_TRANSLATIONS)

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: { fr: 'Électronique', en: 'Electronics' }, slug: 'electronics' },
    })

    const body = (await response.json()) as {
      category: { slug: string; depth: number; parentId: string | null; translations: Record<string, string> }
    }
    expect(response.status).toBe(201)
    expect(body.category.slug).toBe('electronics')
    expect(body.category.depth).toBe(0)
    expect(body.category.parentId).toBeNull()
    expect(body.category.translations).toEqual({ fr: 'Électronique', en: 'Electronics' })
  })

  it('returns 201 with child category whose depth is parent.depth + 1', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockInsertCategoryTransaction(CHILD_CATEGORY)
    mockFindCategoryByIdWithTranslations(CHILD_CATEGORY_WITH_TRANSLATIONS)

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: {
        name: { fr: 'Téléphones', en: 'Smartphones' },
        slug: 'smartphones',
        parentId: ROOT_CATEGORY.id,
      },
    })

    const body = (await response.json()) as { category: { depth: number; parentId: string } }
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
        name: { fr: 'Orphelin', en: 'Orphan' },
        slug: 'orphan',
        parentId: '00000000-0000-0000-0000-0000000000ff',
      },
    })

    const body = (await response.json()) as { code: string }
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
        name: { fr: 'Trop profond', en: 'Too deep' },
        slug: 'too-deep',
        parentId: GRANDCHILD_CATEGORY.id,
      },
    })

    const body = (await response.json()) as { code: string; message: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('CATEGORY_MAX_DEPTH_EXCEEDED')
    expect(body.message).toContain('3 levels')
  })

  it('returns 409 with CONFLICT when slug already exists', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertCategoryTransactionUniqueViolation()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: { fr: 'Doublon', en: 'Duplicate' }, slug: 'duplicate' },
    })

    const body = (await response.json()) as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
  })

  it('returns 422 when slug fails kebab-case validation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: { fr: 'Mauvais slug', en: 'Bad slug' }, slug: 'Bad Slug!' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when name.fr is empty', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: { fr: '', en: 'Ok' }, slug: 'ok' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when name.en is missing (both locales required on create)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: { fr: 'Seulement FR' }, slug: 'only-fr' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when parentId is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: {
        name: { fr: 'Mauvais parent', en: 'Bad parent' },
        slug: 'bad-parent',
        parentId: 'not-a-uuid',
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 on unknown field (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: { fr: 'X', en: 'X' }, slug: 'x', unknownField: 'nope' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: { fr: 'Non', en: 'Nope' }, slug: 'nope' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/admin/categories', {
      method: 'POST',
      body: { name: { fr: 'X', en: 'X' }, slug: 'x' },
    })

    expect(response.status).toBe(401)
  })

  it('logs at info level on successful creation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertCategoryTransaction(ROOT_CATEGORY)
    mockFindCategoryByIdWithTranslations(ROOT_CATEGORY_WITH_TRANSLATIONS)

    await apiRequest('/v1/admin/categories', {
      method: 'POST',
      token,
      body: { name: { fr: 'Électronique', en: 'Electronics' }, slug: 'electronics' },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_category', slug: 'electronics' }),
    )
  })
})

describe('GET /v1/admin/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with every category and their translations dict in a flat list', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([
      ROOT_CATEGORY_WITH_TRANSLATIONS,
      CHILD_CATEGORY_WITH_TRANSLATIONS,
      GRANDCHILD_CATEGORY_WITH_TRANSLATIONS,
    ] as never)

    const response = await apiRequest('/v1/admin/categories', { token })

    const body = (await response.json()) as {
      items: { slug: string; translations: Record<string, string> }[]
      pagination?: unknown
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(3)
    expect(body.items.map((item) => item.slug)).toEqual(['electronics', 'smartphones', 'android'])
    expect(body.items[0]?.translations).toEqual({ fr: 'Électronique', en: 'Electronics' })
    expect(body.pagination).toBeUndefined()
  })

  it('returns an EN-only translations dict when the row only has an English translation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([
      GRANDCHILD_CATEGORY_WITH_TRANSLATIONS,
    ] as never)

    const response = await apiRequest('/v1/admin/categories', { token })

    const body = (await response.json()) as {
      items: { translations: Record<string, string> }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.translations).toEqual({ en: 'Android' })
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

  it('returns 200 with category and full translations dict when found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryByIdWithTranslations(ROOT_CATEGORY_WITH_TRANSLATIONS)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, { token })

    const body = (await response.json()) as {
      category: { id: string; translations: Record<string, string> }
    }
    expect(response.status).toBe(200)
    expect(body.category.id).toBe(ROOT_CATEGORY.id)
    expect(body.category.translations).toEqual({ fr: 'Électronique', en: 'Electronics' })
  })

  it('returns 404 with CATEGORY_NOT_FOUND when category does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryByIdWithTranslations(undefined)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, { token })

    const body = (await response.json()) as { code: string }
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

  it('returns 200 when patching only the French translation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockUpdateTransaction({
      translationUpserts: 1,
      findInsideTx: ROOT_CATEGORY,
    })
    mockFindCategoryByIdWithTranslations({
      ...ROOT_CATEGORY,
      translations: [
        { categoryId: ROOT_CATEGORY.id, locale: 'fr' as const, name: 'Électronique mise à jour' },
        { categoryId: ROOT_CATEGORY.id, locale: 'en' as const, name: 'Electronics' },
      ],
    })

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { name: { fr: 'Électronique mise à jour' } },
    })

    const body = (await response.json()) as {
      category: { translations: Record<string, string> }
    }
    expect(response.status).toBe(200)
    expect(body.category.translations.fr).toBe('Électronique mise à jour')
    expect(body.category.translations.en).toBe('Electronics')
  })

  it('returns 200 when patching only the slug', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockUpdateTransaction({
      updatedRow: { ...ROOT_CATEGORY, slug: 'electronics-new' },
      findInsideTx: { ...ROOT_CATEGORY, slug: 'electronics-new' },
    })
    mockFindCategoryByIdWithTranslations({
      ...ROOT_CATEGORY,
      slug: 'electronics-new',
      translations: ROOT_CATEGORY_TRANSLATIONS,
    })

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { slug: 'electronics-new' },
    })

    const body = (await response.json()) as { category: { slug: string } }
    expect(response.status).toBe(200)
    expect(body.category.slug).toBe('electronics-new')
  })

  it('returns 404 when category not found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(undefined)

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { name: { fr: 'Non' } },
    })

    expect(response.status).toBe(404)
  })

  it('returns 409 CONFLICT when patching slug collides', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindCategoryById(ROOT_CATEGORY)
    mockUpdateTransactionUniqueViolation()

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { slug: 'duplicate' },
    })

    const body = (await response.json()) as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
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

    const body = (await response.json()) as { code: string }
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

    const body = (await response.json()) as { code: string }
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

    const body = (await response.json()) as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/categories/not-a-uuid', {
      method: 'PATCH',
      token,
      body: { name: { fr: 'X' } },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when name is an empty translations dict', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/categories/${ROOT_CATEGORY.id}`, {
      method: 'PATCH',
      token,
      body: { name: {} },
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
      body: { name: { fr: 'X' } },
    })

    expect(response.status).toBe(403)
  })
})

describe('DELETE /v1/admin/categories/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 204 and deletes the category (translations cascade via FK)', async () => {
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

    const body = (await response.json()) as { code: string }
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
      expect.objectContaining({ action: 'admin_delete_category', slug: 'electronics' }),
    )
  })
})
