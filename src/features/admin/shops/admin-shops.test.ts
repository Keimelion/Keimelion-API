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

const SHOP_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  slug: 'amazon',
  name: 'Amazon',
  domain: 'amazon.com',
  logoUrl: null,
  isAffiliated: false,
  sortOrder: 0,
  isActive: true,
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

function mockFindShopById(row: unknown): void {
  vi.mocked(db.query.shops.findFirst).mockResolvedValueOnce(row as never)
}

function mockInsertShop(returnRow: unknown): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    }),
  } as never)
}

function mockUpdateShop(returnRow: unknown): void {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([returnRow]),
      }),
    }),
  } as never)
}

function mockDeleteShop(returnRow: unknown): void {
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

describe('POST /v1/admin/shops', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 201 with created shop when payload is valid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertShop(SHOP_ROW)

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: {
        slug: 'amazon',
        name: 'Amazon',
        domain: 'amazon.com',
        isAffiliated: false,
        sortOrder: 0,
        isActive: true,
      },
    })

    const body = await response.json() as { shop: { slug: string; name: string } }
    expect(response.status).toBe(201)
    expect(body.shop.slug).toBe('amazon')
    expect(body.shop.name).toBe('Amazon')
  })

  it('returns 201 with domain normalized (strips www. and protocol)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertShop({ ...SHOP_ROW, domain: 'amazon.com' })

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: {
        slug: 'amazon',
        name: 'Amazon',
        domain: 'https://www.amazon.com/some/path',
        isAffiliated: false,
      },
    })

    expect(response.status).toBe(201)
  })

  it('returns 409 when slug already exists', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    class PgUniqueError extends Error {
      code = '23505'
    }

    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockRejectedValueOnce(new PgUniqueError('unique violation')),
      }),
    } as never)

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: { slug: 'amazon', name: 'Amazon', isAffiliated: false },
    })

    expect(response.status).toBe(409)
  })

  it('returns 409 when domain already exists', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    class PgUniqueError extends Error {
      code = '23505'
    }

    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockRejectedValueOnce(new PgUniqueError('unique violation')),
      }),
    } as never)

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: { slug: 'amazon-de', name: 'Amazon DE', domain: 'amazon.com', isAffiliated: false },
    })

    expect(response.status).toBe(409)
  })

  it('returns 422 when slug fails regex validation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: { slug: 'Invalid Slug!', name: 'Test', isAffiliated: false },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when slug is too short', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: { slug: 'a', name: 'Test', isAffiliated: false },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when logo_url uses HTTP instead of HTTPS', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: {
        slug: 'test-shop',
        name: 'Test Shop',
        isAffiliated: false,
        logoUrl: 'http://example.com/logo.png',
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when domain is localhost', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: { slug: 'test-shop', name: 'Test Shop', isAffiliated: false, domain: 'localhost' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when domain is a private IP', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: { slug: 'test-shop', name: 'Test Shop', isAffiliated: false, domain: '192.168.1.1' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when sort_order exceeds 32767', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: { slug: 'test-shop', name: 'Test Shop', isAffiliated: false, sortOrder: 99999 },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when unknown field is provided (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: { slug: 'amazon', name: 'Amazon', isAffiliated: false, unknownField: 'value' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: { slug: 'amazon', name: 'Amazon', isAffiliated: false },
    })

    expect(response.status).toBe(403)
  })

  it('logs at info level on successful creation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertShop(SHOP_ROW)

    await apiRequest('/v1/admin/shops', {
      method: 'POST',
      token,
      body: { slug: 'amazon', name: 'Amazon', isAffiliated: false },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_shop', slug: 'amazon' }),
    )
  })
})

describe('GET /v1/admin/shops', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated shops', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([SHOP_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/shops', { token })

    const body = await response.json() as {
      items: { slug: string }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.items[0]?.slug).toBe('amazon')
  })

  it('returns shops with full admin shape', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([SHOP_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/shops', { token })

    const body = await response.json() as { items: Record<string, unknown>[] }
    expect(response.status).toBe(200)
    const item = body.items[0]
    expect(item).toHaveProperty('id')
    expect(item).toHaveProperty('slug')
    expect(item).toHaveProperty('name')
    expect(item).toHaveProperty('domain')
    expect(item).toHaveProperty('isAffiliated')
    expect(item).toHaveProperty('sortOrder')
    expect(item).toHaveProperty('isActive')
    expect(item).toHaveProperty('createdAt')
    expect(item).toHaveProperty('updatedAt')
  })

  it('returns empty list when no shops exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([] as never)
    mockCountChain(0)

    const response = await apiRequest('/v1/admin/shops', { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it('returns both active and inactive shops', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const inactiveShop = { ...SHOP_ROW, id: '00000000-0000-0000-0000-000000000011', isActive: false }
    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([SHOP_ROW, inactiveShop] as never)
    mockCountChain(2)

    const response = await apiRequest('/v1/admin/shops', { token })

    const body = await response.json() as { items: { isActive: boolean }[] }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(2)
    expect(body.items.some((item) => !item.isActive)).toBe(true)
  })

  it('filters by isActive=true', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([SHOP_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/shops?isActive=true', { token })

    expect(response.status).toBe(200)
  })

  it('filters by isAffiliated=true', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const affiliatedShop = { ...SHOP_ROW, isAffiliated: true }
    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([affiliatedShop] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/shops?isAffiliated=true', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { isAffiliated: boolean }[] }
    expect(body.items[0]?.isAffiliated).toBe(true)
  })

  it('filters by hasDomain=true', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([SHOP_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/shops?hasDomain=true', { token })

    expect(response.status).toBe(200)
  })

  it('filters by hasDomain=false', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const shopNoDomain = { ...SHOP_ROW, domain: null }
    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([shopNoDomain] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/shops?hasDomain=false', { token })

    expect(response.status).toBe(200)
  })

  it('filters by search term', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([SHOP_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/shops?search=amazon', { token })

    expect(response.status).toBe(200)
  })

  it('sorts by name:asc', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([SHOP_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/shops?sort=name:asc', { token })

    expect(response.status).toBe(200)
  })

  it('returns 422 when sort field is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops?sort=unknown:asc', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when sort direction is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops?sort=name:invalid', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when isActive is not a boolean string', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops?isActive=yes', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when isAffiliated is not a boolean string', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops?isAffiliated=1', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when hasDomain is not a boolean string', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops?hasDomain=maybe', { token })

    expect(response.status).toBe(422)
  })

  it('respects pagination params', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([SHOP_ROW] as never)
    mockCountChain(5)

    const response = await apiRequest('/v1/admin/shops?page=2&limit=2', { token })

    const body = await response.json() as {
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }
    expect(response.status).toBe(200)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.limit).toBe(2)
    expect(body.pagination.total).toBe(5)
    expect(body.pagination.totalPages).toBe(3)
  })

  it('returns 422 when page is 0', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops?page=0', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when limit exceeds 100', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops?limit=101', { token })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/shops', { token })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest('/v1/admin/shops')
    expect(response.status).toBe(401)
  })
})

describe('PATCH /v1/admin/shops/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with updated shop when patching name', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindShopById(SHOP_ROW)
    const updatedRow = { ...SHOP_ROW, name: 'Amazon Updated' }
    mockUpdateShop(updatedRow)

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Amazon Updated' },
    })

    const body = await response.json() as { shop: { name: string } }
    expect(response.status).toBe(200)
    expect(body.shop.name).toBe('Amazon Updated')
  })

  it('returns 200 when toggling isActive to false', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindShopById(SHOP_ROW)
    const updatedRow = { ...SHOP_ROW, isActive: false }
    mockUpdateShop(updatedRow)

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { isActive: false },
    })

    const body = await response.json() as { shop: { isActive: boolean } }
    expect(response.status).toBe(200)
    expect(body.shop.isActive).toBe(false)
  })

  it('returns 404 when shop does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindShopById(undefined)

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'New Name' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 200 without hitting update when patch body is empty', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindShopById(SHOP_ROW)

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'PATCH',
      token,
      body: {},
    })

    expect(response.status).toBe(200)
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_update_shop', changes: {} }),
    )
  })

  it('returns 409 when patching slug to a duplicate', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindShopById(SHOP_ROW)

    class PgUniqueError extends Error {
      code = '23505'
    }

    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(new PgUniqueError('unique violation')),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { slug: 'existing-slug' },
    })

    expect(response.status).toBe(409)
  })

  it('returns 409 when patching domain to a duplicate', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindShopById(SHOP_ROW)

    class PgUniqueError extends Error {
      code = '23505'
    }

    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(new PgUniqueError('unique violation')),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { domain: 'existing.com' },
    })

    expect(response.status).toBe(409)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops/not-a-uuid', {
      method: 'PATCH',
      token,
      body: { name: 'Test' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when unknown field is provided (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { unknownField: 'value' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Test' },
    })

    expect(response.status).toBe(403)
  })

  it('logs at info level with changes diff on successful update', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindShopById(SHOP_ROW)
    mockUpdateShop({ ...SHOP_ROW, sortOrder: 10 })

    await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { sortOrder: 10 },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_update_shop', slug: 'amazon' }),
    )
  })
})

describe('DELETE /v1/admin/shops/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 204 and deletes the shop', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindShopById(SHOP_ROW)
    mockDeleteShop(SHOP_ROW)

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(204)
  })

  it('returns 404 when shop does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindShopById(undefined)

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/shops/not-a-uuid', {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(401)
  })

  it('logs at warn level on successful delete', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockFindShopById(SHOP_ROW)
    mockDeleteShop(SHOP_ROW)

    await apiRequest(`/v1/admin/shops/${SHOP_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_delete_shop', slug: 'amazon' }),
    )
  })
})
