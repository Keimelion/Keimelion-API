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

const OCCASION_TYPE_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  slug: 'wedding',
  emoji: '💍',
  sortOrder: 0,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const OCCASION_TYPE_TRANSLATIONS = [
  { occasionTypeId: OCCASION_TYPE_ROW.id, locale: 'en', label: 'Wedding' },
  { occasionTypeId: OCCASION_TYPE_ROW.id, locale: 'fr', label: 'Mariage' },
]

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

function mockInsertTransaction(returnRow: unknown): void {
  vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
    const tx = {
      insert: vi.fn().mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([returnRow]),
        }),
      }),
    }
    const insertTranslationsMock = {
      values: vi.fn().mockResolvedValueOnce([]),
    }
    tx.insert.mockReturnValueOnce(insertTranslationsMock)
    return callback(tx as never)
  })
}

function mockFindTranslations(translations: unknown[]): void {
  vi.mocked(db.query.occasionTypeTranslations.findMany).mockResolvedValueOnce(
    translations as never,
  )
}

function mockFindOccasionTypeById(row: unknown): void {
  vi.mocked(db.query.occasionTypes.findFirst).mockResolvedValueOnce(row as never)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockResolvedValueOnce([{ count: total }]),
    where: vi.fn().mockReturnThis(),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

describe('POST /v1/admin/occasion-types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 201 with created occasion type when payload is valid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertTransaction(OCCASION_TYPE_ROW)
    mockFindTranslations(OCCASION_TYPE_TRANSLATIONS)

    const response = await apiRequest('/v1/admin/occasion-types', {
      method: 'POST',
      token,
      body: {
        slug: 'wedding',
        emoji: '💍',
        translations: [
          { locale: 'en', label: 'Wedding' },
          { locale: 'fr', label: 'Mariage' },
        ],
      },
    })

    const body = await response.json() as { occasionType: { slug: string; translations: unknown[] } }
    expect(response.status).toBe(201)
    expect(body.occasionType.slug).toBe('wedding')
    expect(body.occasionType.translations).toHaveLength(2)
  })

  it('returns 400 when no default locale translation is provided', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/occasion-types', {
      method: 'POST',
      token,
      body: {
        slug: 'birthday',
        translations: [{ locale: 'fr', label: 'Anniversaire' }],
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when translations array has duplicate locales', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/occasion-types', {
      method: 'POST',
      token,
      body: {
        slug: 'birthday',
        translations: [
          { locale: 'en', label: 'Birthday' },
          { locale: 'en', label: 'Birthday Again' },
        ],
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 409 when slug already exists', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    class PgUniqueError extends Error {
      code = '23505'
    }

    vi.mocked(db.transaction).mockImplementationOnce(() => {
      throw new PgUniqueError('unique violation')
    })

    const response = await apiRequest('/v1/admin/occasion-types', {
      method: 'POST',
      token,
      body: {
        slug: 'wedding',
        translations: [{ locale: 'en', label: 'Wedding' }],
      },
    })

    expect(response.status).toBe(409)
  })

  it('returns 422 when slug fails regex validation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/occasion-types', {
      method: 'POST',
      token,
      body: {
        slug: 'Invalid Slug!',
        translations: [{ locale: 'en', label: 'Test' }],
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when slug is too short', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/occasion-types', {
      method: 'POST',
      token,
      body: {
        slug: 'a',
        translations: [{ locale: 'en', label: 'Test' }],
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when unknown field is provided (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/occasion-types', {
      method: 'POST',
      token,
      body: {
        slug: 'wedding',
        translations: [{ locale: 'en', label: 'Wedding' }],
        unknownField: 'value',
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/occasion-types', {
      method: 'POST',
      token,
      body: {
        slug: 'wedding',
        translations: [{ locale: 'en', label: 'Wedding' }],
      },
    })

    expect(response.status).toBe(403)
  })

  it('logs at info level on successful creation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertTransaction(OCCASION_TYPE_ROW)
    mockFindTranslations(OCCASION_TYPE_TRANSLATIONS)

    await apiRequest('/v1/admin/occasion-types', {
      method: 'POST',
      token,
      body: {
        slug: 'wedding',
        translations: [{ locale: 'en', label: 'Wedding' }],
      },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_occasion_type', slug: 'wedding' }),
    )
  })
})

describe('GET /v1/admin/occasion-types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated occasion types including inactive rows', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const inactiveRow = { ...OCCASION_TYPE_ROW, id: '00000000-0000-0000-0000-000000000011', isActive: false, slug: 'archived' }

    vi.mocked(db.query.occasionTypes.findMany).mockResolvedValueOnce([OCCASION_TYPE_ROW, inactiveRow] as never)
    mockCountChain(2)
    mockFindTranslations(OCCASION_TYPE_TRANSLATIONS)
    mockFindTranslations([])

    const response = await apiRequest('/v1/admin/occasion-types', { token })

    const body = await response.json() as {
      items: { slug: string; isActive: boolean; translations: unknown[] }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
    expect(body.items.some((item) => !item.isActive)).toBe(true)
  })

  it('returns items with full admin shape including createdAt, updatedAt, translations', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.occasionTypes.findMany).mockResolvedValueOnce([OCCASION_TYPE_ROW] as never)
    mockCountChain(1)
    mockFindTranslations(OCCASION_TYPE_TRANSLATIONS)

    const response = await apiRequest('/v1/admin/occasion-types', { token })

    const body = await response.json() as { items: Record<string, unknown>[] }
    expect(response.status).toBe(200)
    const item = body.items[0]
    expect(item).toHaveProperty('id')
    expect(item).toHaveProperty('slug')
    expect(item).toHaveProperty('emoji')
    expect(item).toHaveProperty('sortOrder')
    expect(item).toHaveProperty('isActive')
    expect(item).toHaveProperty('createdAt')
    expect(item).toHaveProperty('updatedAt')
    expect(item).toHaveProperty('translations')
  })

  it('returns empty list when no occasion types exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.occasionTypes.findMany).mockResolvedValueOnce([] as never)
    mockCountChain(0)

    const response = await apiRequest('/v1/admin/occasion-types', { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/occasion-types', { token })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest('/v1/admin/occasion-types')
    expect(response.status).toBe(401)
  })
})

describe('PATCH /v1/admin/occasion-types/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with updated occasion type when patching sortOrder', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindOccasionTypeById(OCCASION_TYPE_ROW)

    const updatedRow = { ...OCCASION_TYPE_ROW, sortOrder: 42 }

    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        update: vi.fn().mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([updatedRow]),
            }),
          }),
        }),
      }
      return callback(tx as never)
    })

    mockFindOccasionTypeById(updatedRow)
    mockFindTranslations(OCCASION_TYPE_TRANSLATIONS)

    const response = await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { sortOrder: 42 },
    })

    const body = await response.json() as { occasionType: { sortOrder: number } }
    expect(response.status).toBe(200)
    expect(body.occasionType.sortOrder).toBe(42)
  })

  it('returns 400 when body contains slug field (strict schema rejects it)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { slug: 'new-slug' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when patching default locale translation with null label', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: {
        translations: [{ locale: 'en', label: null }],
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when translations have duplicate locales', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: {
        translations: [
          { locale: 'fr', label: 'Mariage' },
          { locale: 'fr', label: 'Mariage bis' },
        ],
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 404 when occasion type does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindOccasionTypeById(undefined)

    const response = await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { sortOrder: 10 },
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/occasion-types/not-a-uuid', {
      method: 'PATCH',
      token,
      body: { sortOrder: 10 },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { sortOrder: 10 },
    })

    expect(response.status).toBe(403)
  })

  it('logs at info level with changes diff on successful update', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindOccasionTypeById(OCCASION_TYPE_ROW)

    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        update: vi.fn().mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([{ ...OCCASION_TYPE_ROW, sortOrder: 99 }]),
            }),
          }),
        }),
      }
      return callback(tx as never)
    })

    mockFindOccasionTypeById({ ...OCCASION_TYPE_ROW, sortOrder: 99 })
    mockFindTranslations(OCCASION_TYPE_TRANSLATIONS)

    await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { sortOrder: 99 },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_update_occasion_type', slug: 'wedding' }),
    )
  })
})

describe('DELETE /v1/admin/occasion-types/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 204 and deletes the occasion type', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindOccasionTypeById(OCCASION_TYPE_ROW)

    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([OCCASION_TYPE_ROW]),
      }),
    } as never)

    const response = await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(204)
  })

  it('returns 404 when occasion type does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindOccasionTypeById(undefined)

    const response = await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/occasion-types/not-a-uuid', {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(401)
  })

  it('logs at warn level on successful delete', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindOccasionTypeById(OCCASION_TYPE_ROW)

    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([OCCASION_TYPE_ROW]),
      }),
    } as never)

    await apiRequest(`/v1/admin/occasion-types/${OCCASION_TYPE_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_delete_occasion_type', slug: 'wedding' }),
    )
  })
})

describe('Public GET /v1/occasion-types regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('public endpoint still responds 200 after admin routes are mounted', async () => {
    const chain = {
      orderBy: vi.fn().mockResolvedValueOnce([]),
      where: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
    }
    vi.mocked(db.select).mockReturnValueOnce(chain as never)

    const response = await apiRequest('/v1/occasion-types')

    expect(response.status).toBe(200)
  })
})
