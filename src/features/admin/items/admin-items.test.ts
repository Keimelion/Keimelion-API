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

const ITEM_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Test Item',
  description: 'A test item',
  imageUrl: null,
  createdByUserId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const SHOP_ROW = {
  id: '00000000-0000-0000-0000-000000000020',
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

interface SourceRow {
  id: string
  itemId: string
  shopId: string | null
  sourceUrl: string | null
  price: string | null
  currency: string
  createdAt: Date
  updatedAt: Date
  shop: typeof SHOP_ROW | null
}

const SOURCE_ROW: SourceRow = {
  id: '00000000-0000-0000-0000-000000000030',
  itemId: ITEM_ROW.id,
  shopId: null,
  sourceUrl: null,
  price: null,
  currency: 'EUR',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  shop: null,
}

const SOURCE_WITH_SHOP_ROW = {
  ...SOURCE_ROW,
  id: '00000000-0000-0000-0000-000000000031',
  shopId: SHOP_ROW.id,
  shop: SHOP_ROW,
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

function mockFindItemById(row: unknown): void {
  vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(row as never)
}

function mockFindItemSourceById(row: unknown): void {
  vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(row as never)
}

function mockFindItemSourceByIdWithShop(row: unknown, shop: unknown): void {
  const rowOut =
    row === undefined || row === null
      ? undefined
      : { ...(row as object), shop }
  vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(rowOut as never)
}

function mockFindShopById(row: unknown): void {
  vi.mocked(db.query.shops.findFirst).mockResolvedValueOnce(row as never)
}

function mockExistsItemSourceForShop(exists: boolean): void {
  vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(
    (exists ? { id: 'any-id' } : undefined) as never,
  )
}

function mockInsertItemSourceUniqueViolation(): void {
  const error = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
  })
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockRejectedValueOnce(error),
    }),
  } as never)
}

function mockUpdateItemSourceUniqueViolation(): void {
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

function itemWith(sources: SourceRow[]): typeof ITEM_ROW & {
  sources: SourceRow[]
  itemCategories: never[]
  itemTags: never[]
} {
  return { ...ITEM_ROW, sources, itemCategories: [], itemTags: [] }
}

function buildTxInsertMock(rows: unknown[]): ReturnType<typeof vi.fn> {
  const insert = vi.fn()
  for (const row of rows) {
    insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([row]),
      }),
    })
  }
  return insert
}

function mockCreateItemTransaction(itemRow: unknown, sourceRows: unknown[]): void {
  vi.mocked(db.transaction).mockImplementationOnce((callback) => {
    const tx = {
      insert: buildTxInsertMock([itemRow, ...sourceRows]),
      update: vi.fn(),
      delete: vi.fn(),
      select: vi.fn(),
    }
    return callback(tx as never) as never
  })
}

function mockCreateItemTransactionFailure(): void {
  vi.mocked(db.transaction).mockImplementationOnce(() => {
    throw new Error('insert failed')
  })
}

function mockUpdateItem(returnRow: unknown): void {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([returnRow]),
      }),
    }),
  } as never)
}

function mockInsertItemSource(returnRow: unknown): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    }),
  } as never)
}

function mockUpdateItemSource(returnRow: unknown): void {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([returnRow]),
      }),
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

function mockHardDeleteTransaction(refCount: number, deletedRow: unknown): void {
  const txSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ total: refCount }]),
  }
  const txDeleteChain = {
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([deletedRow]),
    }),
  }
  vi.mocked(db.transaction).mockImplementationOnce((callback) => {
    const tx = {
      select: vi.fn().mockReturnValueOnce(txSelectChain),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn().mockReturnValueOnce(txDeleteChain),
    }
    return callback(tx as never) as never
  })
}

interface DeleteSourceTransactionSpies {
  deleteCall: ReturnType<typeof vi.fn>
}

function mockDeleteSourceTransaction(sourceCount: number, returnRow: unknown): DeleteSourceTransactionSpies {
  const txSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ total: sourceCount }]),
  }
  const deleteCall = vi.fn().mockReturnValueOnce({
    where: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    }),
  })
  vi.mocked(db.transaction).mockImplementationOnce((callback) => {
    const tx = {
      select: vi.fn().mockReturnValueOnce(txSelectChain),
      update: vi.fn(),
      insert: vi.fn(),
      delete: deleteCall,
    }
    return callback(tx as never) as never
  })
  return { deleteCall }
}

describe('POST /v1/admin/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 201 with created item and sources when payload is valid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockCreateItemTransaction(ITEM_ROW, [SOURCE_ROW])
    mockFindItemById(itemWith([SOURCE_ROW]))

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', sources: [{ currency: 'EUR' }] },
    })

    const body = await response.json() as {
      item: { name: string; createdByUserId: null; sources: { itemId: string }[] }
    }
    expect(response.status).toBe(201)
    expect(body.item.name).toBe('Test Item')
    expect(body.item.createdByUserId).toBeNull()
    expect(body.item.sources).toHaveLength(1)
    expect(body.item.sources[0]?.itemId).toBe(ITEM_ROW.id)
  })

  it('embeds shop object on source when shopId is provided', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockCreateItemTransaction(ITEM_ROW, [SOURCE_WITH_SHOP_ROW])
    mockFindItemById(itemWith([SOURCE_WITH_SHOP_ROW]))

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', sources: [{ shopId: SHOP_ROW.id, currency: 'EUR' }] },
    })

    const body = await response.json() as {
      item: { sources: { shopId: string | null; shop: { slug: string } | null }[] }
    }
    expect(response.status).toBe(201)
    expect(body.item.sources[0]?.shopId).toBe(SHOP_ROW.id)
    expect(body.item.sources[0]?.shop?.slug).toBe(SHOP_ROW.slug)
  })

  it('logs at info level on successful creation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockCreateItemTransaction(ITEM_ROW, [SOURCE_ROW])
    mockFindItemById(itemWith([SOURCE_ROW]))

    await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', sources: [{ currency: 'EUR' }] },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_item', itemId: ITEM_ROW.id }),
    )
  })

  it('returns 422 when sources is missing', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when sources is an empty array', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', sources: [] },
    })

    expect(response.status).toBe(422)
  })

  it('returns 500 and rolls back when a source insert fails', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockCreateItemTransactionFailure()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', sources: [{ currency: 'EUR' }] },
    })

    expect(response.status).toBe(500)
  })

  it('returns 422 when name is empty', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: '', sources: [{ currency: 'EUR' }] },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when imageUrl uses HTTP', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Test',
        imageUrl: 'http://example.com/image.jpg',
        sources: [{ currency: 'EUR' }],
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when unknown field is provided (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test', unknownField: 'value', sources: [{ currency: 'EUR' }] },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test', sources: [{ currency: 'EUR' }] },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      body: { name: 'Test', sources: [{ currency: 'EUR' }] },
    })

    expect(response.status).toBe(401)
  })

  it('returns 422 when two sources share the same non-null shopId (Zod refine)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Test Item',
        sources: [
          { shopId: SHOP_ROW.id, currency: 'EUR' },
          { shopId: SHOP_ROW.id, currency: 'USD' },
        ],
      },
    })

    const body = await response.json() as {
      code: string
      metadata: { issues: { path: string; message: string }[] }
    }
    expect(response.status).toBe(422)
    expect(body.code).toBe('UNPROCESSABLE_ENTITY')
    const paths = body.metadata.issues.map((issue) => issue.path).sort()
    expect(paths).toEqual(['sources.0.shopId', 'sources.1.shopId'])
    expect(body.metadata.issues[0]?.message).toContain('already used by another source')
  })

  it('returns 201 when multiple sources share shopId = null (allowed)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockCreateItemTransaction(ITEM_ROW, [SOURCE_ROW, { ...SOURCE_ROW, id: 'another-id' }])
    mockFindItemById(itemWith([SOURCE_ROW, { ...SOURCE_ROW, id: 'another-id' }]))

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Test Item',
        sources: [
          { shopId: null, currency: 'EUR' },
          { shopId: null, currency: 'USD' },
        ],
      },
    })

    expect(response.status).toBe(201)
  })
})

describe('GET /v1/admin/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated items including sources array on each item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([SOURCE_ROW])] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items', { token })

    const body = await response.json() as {
      items: { name: string; sources: { itemId: string }[] }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.items[0]?.sources).toHaveLength(1)
    expect(body.items[0]?.sources[0]?.itemId).toBe(ITEM_ROW.id)
  })

  it('embeds shop object on sources that reference a shop', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([SOURCE_WITH_SHOP_ROW])] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items', { token })

    const body = await response.json() as {
      items: { sources: { shopId: string | null; shop: { slug: string } | null }[] }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.sources[0]?.shop?.slug).toBe(SHOP_ROW.slug)
    expect(body.items[0]?.sources[0]?.shop).not.toHaveProperty('isActive')
  })

  it('does not expose deletedAt on items in response', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items', { token })

    const body = await response.json() as { items: Record<string, unknown>[] }
    expect(body.items[0]).not.toHaveProperty('deletedAt')
    expect(body.items[0]).toHaveProperty('sources')
  })

  it('returns an empty sources array for legacy items with zero sources', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items', { token })

    const body = await response.json() as { items: { sources: unknown[] }[] }
    expect(response.status).toBe(200)
    expect(body.items[0]?.sources).toEqual([])
  })

  it('returns empty list when no items exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([] as never)
    mockCountChain(0)

    const response = await apiRequest('/v1/admin/items', { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it('issues a single query for items with embedded sources+shop (no batch reloads)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([SOURCE_WITH_SHOP_ROW])] as never)
    mockCountChain(1)

    await apiRequest('/v1/admin/items', { token })

    expect(vi.mocked(db.query.items.findMany)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(db.query.itemSources.findMany)).not.toHaveBeenCalled()
    expect(vi.mocked(db.query.shops.findMany)).not.toHaveBeenCalled()
  })

  it('sorts by createdAt:desc by default', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items', { token })
    expect(response.status).toBe(200)
  })

  it('filters by name[ilike]', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items?name%5Bilike%5D=test', { token })
    expect(response.status).toBe(200)
  })

  it('filters by createdByUserId[isNull]=true (catalog-only items)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items?createdByUserId%5BisNull%5D=true', { token })
    expect(response.status).toBe(200)
  })

  it('sorts by name:asc', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items?sort=name:asc', { token })
    expect(response.status).toBe(200)
  })

  it('returns 422 when sort field is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items?sort=unknown:asc', { token })
    expect(response.status).toBe(422)
  })

  it('returns 422 when bracket-syntax uses an unknown field', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items?unknownField%5Beq%5D=foo', { token })
    expect(response.status).toBe(422)
  })

  it('returns 422 when deletedAt filter is provided (filter removed)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items?deletedAt%5BisNull%5D=false', { token })
    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/items', { token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest('/v1/admin/items')
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with item and sources', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(itemWith([SOURCE_ROW]))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, { token })

    const body = await response.json() as {
      item: { name: string; sources: unknown[] }
    }
    expect(response.status).toBe(200)
    expect(body.item.name).toBe('Test Item')
    expect(body.item.sources).toHaveLength(1)
  })

  it('does not expose deletedAt on item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(itemWith([]))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, { token })

    const body = await response.json() as { item: Record<string, unknown> }
    expect(response.status).toBe(200)
    expect(body.item).not.toHaveProperty('deletedAt')
  })

  it('returns 404 when item does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(undefined)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, { token })
    expect(response.status).toBe(404)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items/not-a-uuid', { token })
    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, { token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`)
    expect(response.status).toBe(401)
  })
})

describe('PATCH /v1/admin/items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with updated item (with sources) when patching name', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockUpdateItem({ ...ITEM_ROW, name: 'Updated Name' })
    mockFindItemById({ ...itemWith([SOURCE_ROW]), name: 'Updated Name' })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Updated Name' },
    })

    const body = await response.json() as { item: { name: string; sources: unknown[] } }
    expect(response.status).toBe(200)
    expect(body.item.name).toBe('Updated Name')
    expect(body.item.sources).toHaveLength(1)
  })

  it('logs with url fields redacted in changes diff', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById({ ...ITEM_ROW, imageUrl: 'https://old.example.com/img.jpg' })
    mockUpdateItem({ ...ITEM_ROW, imageUrl: 'https://new.example.com/img.jpg' })
    mockFindItemById(itemWith([]))

    await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { imageUrl: 'https://new.example.com/img.jpg' },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin_update_item',
        changes: { imageUrl: { from: '<url>', to: '<url>' } },
      }),
    )
  })

  it('returns 422 when body is empty (no fields)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: {},
    })

    expect(response.status).toBe(422)
  })

  it('returns 404 when item does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(undefined)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Updated' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when imageUrl uses HTTP', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { imageUrl: 'http://example.com/img.jpg' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when unknown field is provided (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { unknownField: 'value' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items/not-a-uuid', {
      method: 'PATCH',
      token,
      body: { name: 'Test' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Test' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      body: { name: 'Test' },
    })

    expect(response.status).toBe(401)
  })
})

describe('DELETE /v1/admin/items/:id (hard delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with success message when no list_items reference it', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockHardDeleteTransaction(0, ITEM_ROW)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toContain('deleted')
  })

  it('returns 409 when list_items reference the item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockHardDeleteTransaction(3, ITEM_ROW)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    const body = await response.json() as { code: string; metadata: { message: string } }
    expect(response.status).toBe(409)
    expect(body.metadata.message).toContain('3')
  })

  it('returns 404 when the item does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockHardDeleteTransaction(0, undefined)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('logs at warn level on successful delete', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockHardDeleteTransaction(0, ITEM_ROW)

    await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_delete_item', itemId: ITEM_ROW.id }),
    )
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items/not-a-uuid', {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(401)
  })
})

describe('POST /v1/admin/items/:id/restore (removed)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 404 because the endpoint no longer exists', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/restore`, {
      method: 'POST',
      token,
    })
    expect(response.status).toBe(404)
  })
})

describe('GET /v1/admin/items/:id/sources (removed)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  // No auth mock — GET on this path is not mounted, so no middleware runs.
  // Hono short-circuits with 404 before hitting authMiddleware.
  it('returns 404 because the endpoint no longer exists', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, { token })
    expect(response.status).toBe(404)
  })
})

describe('POST /v1/admin/items/:id/sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 201 with created source', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockInsertItemSource(SOURCE_ROW)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { currency: 'EUR' },
    })

    const body = await response.json() as { source: { itemId: string; shop: unknown } }
    expect(response.status).toBe(201)
    expect(body.source.itemId).toBe(ITEM_ROW.id)
    expect(body.source.shop).toBeNull()
  })

  it('returns 201 with embedded shop when shopId is provided', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockFindShopById(SHOP_ROW)
    mockInsertItemSource(SOURCE_WITH_SHOP_ROW)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { shopId: SHOP_ROW.id, currency: 'EUR' },
    })

    const body = await response.json() as { source: { shop: { slug: string } | null } }
    expect(response.status).toBe(201)
    expect(body.source.shop?.slug).toBe(SHOP_ROW.slug)
  })

  it('returns 404 when parent item does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(undefined)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { currency: 'EUR' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 when shopId does not exist or is inactive', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockFindShopById(undefined)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { shopId: SHOP_ROW.id },
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when shopId is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { shopId: 'not-a-uuid' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when price format is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { price: 'not-a-price' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when currency is not 3 uppercase letters', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { currency: 'eur' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when sourceUrl uses HTTP', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { sourceUrl: 'http://example.com' },
    })

    expect(response.status).toBe(422)
  })

  it('logs at info level on successful creation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockInsertItemSource(SOURCE_ROW)

    await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: {},
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_item_source' }),
    )
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: {},
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      body: {},
    })

    expect(response.status).toBe(401)
  })

  it('returns 409 when the item already has a source for the same shop', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockFindShopById(SHOP_ROW)
    mockExistsItemSourceForShop(true)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { shopId: SHOP_ROW.id, currency: 'EUR' },
    })

    const body = await response.json() as { code: string; message: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('DUPLICATE_SHOP_FOR_ITEM')
    expect(body.message).toBe('This shop is already used by another source of this item.')
  })

  it('returns 409 when the DB unique index rejects a concurrent duplicate insert', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockFindShopById(SHOP_ROW)
    mockExistsItemSourceForShop(false)
    mockInsertItemSourceUniqueViolation()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { shopId: SHOP_ROW.id, currency: 'EUR' },
    })

    const body = await response.json() as { code: string; message: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('DUPLICATE_SHOP_FOR_ITEM')
    expect(body.message).toBe('This shop is already used by another source of this item.')
  })

  it('skips the uniqueness probe when shopId is null (any number allowed)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockInsertItemSource(SOURCE_ROW)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { shopId: null, currency: 'EUR' },
    })

    expect(response.status).toBe(201)
    // Only the auth findFirst runs; the uniqueness probe is not reached.
    expect(vi.mocked(db.query.itemSources.findFirst)).not.toHaveBeenCalled()
  })
})

describe('PATCH /v1/admin/items/:id/sources/:sourceId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with updated source', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockUpdateItemSource({ ...SOURCE_ROW, currency: 'USD' })
    mockFindItemSourceByIdWithShop({ ...SOURCE_ROW, currency: 'USD' }, null)

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { currency: 'USD' },
      },
    )

    const body = await response.json() as { source: { currency: string; shop: unknown } }
    expect(response.status).toBe(200)
    expect(body.source.currency).toBe('USD')
    expect(body.source.shop).toBeNull()
  })

  it('embeds the updated shop when shopId is patched to a valid shop', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockFindShopById(SHOP_ROW)
    mockExistsItemSourceForShop(false)
    mockUpdateItemSource({ ...SOURCE_ROW, shopId: SHOP_ROW.id })
    mockFindItemSourceByIdWithShop({ ...SOURCE_ROW, shopId: SHOP_ROW.id }, SHOP_ROW)

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { shopId: SHOP_ROW.id },
      },
    )

    const body = await response.json() as { source: { shop: { slug: string } | null } }
    expect(response.status).toBe(200)
    expect(body.source.shop?.slug).toBe(SHOP_ROW.slug)
  })

  it('logs at info level on successful update', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockUpdateItemSource({ ...SOURCE_ROW, currency: 'USD' })
    mockFindItemSourceByIdWithShop({ ...SOURCE_ROW, currency: 'USD' }, null)

    await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { currency: 'USD' },
      },
    )

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_update_item_source' }),
    )
  })

  it('returns 404 when sourceId does not belong to itemId (IDOR guard)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById({ ...SOURCE_ROW, itemId: 'different-item-id' })

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { currency: 'USD' },
      },
    )

    expect(response.status).toBe(404)
  })

  it('returns 404 when source does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(undefined)

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { currency: 'USD' },
      },
    )

    expect(response.status).toBe(404)
  })

  it('returns 422 when id or sourceId is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources/not-a-uuid`, {
      method: 'PATCH',
      token,
      body: { currency: 'USD' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { currency: 'USD' },
      },
    )

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        body: { currency: 'USD' },
      },
    )

    expect(response.status).toBe(401)
  })

  it('returns 409 when patching shopId to one already used by another source of the item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockFindShopById(SHOP_ROW)
    mockExistsItemSourceForShop(true)

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { shopId: SHOP_ROW.id },
      },
    )

    const body = await response.json() as { code: string; message: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('DUPLICATE_SHOP_FOR_ITEM')
    expect(body.message).toBe('This shop is already used by another source of this item.')
  })

  it('returns 409 when the DB unique index rejects a concurrent duplicate update', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockFindShopById(SHOP_ROW)
    mockExistsItemSourceForShop(false)
    mockUpdateItemSourceUniqueViolation()

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { shopId: SHOP_ROW.id },
      },
    )

    const body = await response.json() as { code: string; message: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('DUPLICATE_SHOP_FOR_ITEM')
    expect(body.message).toBe('This shop is already used by another source of this item.')
  })

  it('skips the uniqueness probe when shopId is unchanged', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById({ ...SOURCE_ROW, shopId: SHOP_ROW.id })
    mockFindShopById(SHOP_ROW)
    mockUpdateItemSource({ ...SOURCE_ROW, shopId: SHOP_ROW.id, currency: 'USD' })
    mockFindItemSourceByIdWithShop({ ...SOURCE_ROW, shopId: SHOP_ROW.id, currency: 'USD' }, SHOP_ROW)

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { shopId: SHOP_ROW.id, currency: 'USD' },
      },
    )

    expect(response.status).toBe(200)
    // Only findItemSourceById + findItemSourceByIdWithShop (both use itemSources.findFirst),
    // so exactly 2 calls — the probe would push it to 3.
    expect(vi.mocked(db.query.itemSources.findFirst)).toHaveBeenCalledTimes(2)
  })
})

describe('DELETE /v1/admin/items/:id/sources/:sourceId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with success message when the item has other sources', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockDeleteSourceTransaction(2, SOURCE_ROW)

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      { method: 'DELETE', token },
    )

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toContain('deleted')
  })

  it('returns 409 when removing the last source and does not run the delete', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    const { deleteCall } = mockDeleteSourceTransaction(1, SOURCE_ROW)

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      { method: 'DELETE', token },
    )

    const body = await response.json() as { code: string; metadata: { message: string } }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
    expect(body.metadata.message).toBe('Cannot remove the last source of an item')
    expect(deleteCall).not.toHaveBeenCalled()
  })

  it('does not log the delete action when the last-source guard rejects the call', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockDeleteSourceTransaction(1, SOURCE_ROW)

    await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      { method: 'DELETE', token },
    )

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_delete_item_source' }),
    )
  })

  it('returns 404 when sourceId does not belong to itemId (IDOR guard)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById({ ...SOURCE_ROW, itemId: 'different-item-id' })

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      { method: 'DELETE', token },
    )

    expect(response.status).toBe(404)
  })

  it('returns 404 when source does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(undefined)

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      { method: 'DELETE', token },
    )

    expect(response.status).toBe(404)
  })

  it('logs at warn level on successful delete', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockDeleteSourceTransaction(2, SOURCE_ROW)

    await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      { method: 'DELETE', token },
    )

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_delete_item_source' }),
    )
  })

  it('returns 422 when sourceId is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/not-a-uuid`,
      { method: 'DELETE', token },
    )

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      { method: 'DELETE', token },
    )

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      { method: 'DELETE' },
    )

    expect(response.status).toBe(401)
  })
})
