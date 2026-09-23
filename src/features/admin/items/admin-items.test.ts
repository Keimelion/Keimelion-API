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
  moderationStatus: 'approved' as const,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const DELETED_ITEM_ROW = {
  ...ITEM_ROW,
  id: '00000000-0000-0000-0000-000000000011',
  deletedAt: new Date('2024-06-01'),
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

const SOURCE_ROW = {
  id: '00000000-0000-0000-0000-000000000030',
  itemId: ITEM_ROW.id,
  shopId: null,
  sourceUrl: null,
  price: null,
  currency: 'EUR',
  isPrimary: false,
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

function mockFindItemById(row: unknown): void {
  vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(row as never)
}

function mockFindItemSourceById(row: unknown): void {
  vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(row as never)
}

function mockInsertItem(returnRow: unknown): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    }),
  } as never)
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

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockDeleteTransaction(refCount: number, returnRow: unknown): void {
  const txUpdateReturnValue = {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([returnRow]),
      }),
    }),
  }
  const txSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ total: refCount }]),
  }
  vi.mocked(db.transaction).mockImplementationOnce((callback) => {
    const tx = {
      select: vi.fn().mockReturnValueOnce(txSelectChain),
      update: vi.fn().mockReturnValueOnce(txUpdateReturnValue),
      insert: vi.fn(),
      delete: vi.fn(),
    }
    return callback(tx as never) as never
  })
}

describe('POST /v1/admin/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 201 with created item when payload is valid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertItem(ITEM_ROW)

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item' },
    })

    const body = await response.json() as { item: { name: string; createdByUserId: null } }
    expect(response.status).toBe(201)
    expect(body.item.name).toBe('Test Item')
    expect(body.item.createdByUserId).toBeNull()
  })

  it('returns 201 with default moderationStatus=approved when not specified', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertItem(ITEM_ROW)

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item' },
    })

    const body = await response.json() as { item: { moderationStatus: string } }
    expect(response.status).toBe(201)
    expect(body.item.moderationStatus).toBe('approved')
  })

  it('returns 201 with custom moderationStatus', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertItem({ ...ITEM_ROW, moderationStatus: 'pending' })

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', moderationStatus: 'pending' },
    })

    const body = await response.json() as { item: { moderationStatus: string } }
    expect(response.status).toBe(201)
    expect(body.item.moderationStatus).toBe('pending')
  })

  it('logs at info level on successful creation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertItem(ITEM_ROW)

    await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item' },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_item', itemId: ITEM_ROW.id }),
    )
  })

  it('returns 422 when name is empty', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: '' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when moderationStatus is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test', moderationStatus: 'invalid' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when imageUrl uses HTTP', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test', imageUrl: 'http://example.com/image.jpg' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when unknown field is provided (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test', unknownField: 'value' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      body: { name: 'Test' },
    })

    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated items', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items', { token })

    const body = await response.json() as {
      items: { name: string }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('returns items with deletedAt field in response', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items', { token })

    const body = await response.json() as { items: Record<string, unknown>[] }
    expect(body.items[0]).toHaveProperty('deletedAt')
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

  it('sorts by createdAt:desc by default', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items', { token })
    expect(response.status).toBe(200)
  })

  it('filters by moderationStatus[eq]', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items?moderationStatus%5Beq%5D=approved', { token })
    expect(response.status).toBe(200)
  })

  it('filters by name[ilike]', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items?name%5Bilike%5D=test', { token })
    expect(response.status).toBe(200)
  })

  it('filters by createdByUserId[isNull]=true (catalog-only items)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/items?createdByUserId%5BisNull%5D=true', { token })
    expect(response.status).toBe(200)
  })

  it('sorts by name:asc', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
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
    mockFindItemById(ITEM_ROW)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([SOURCE_ROW] as never)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, { token })

    const body = await response.json() as {
      item: { name: string; sources: unknown[] }
    }
    expect(response.status).toBe(200)
    expect(body.item.name).toBe('Test Item')
    expect(body.item.sources).toHaveLength(1)
  })

  it('returns 200 with deletedAt populated for soft-deleted items', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(DELETED_ITEM_ROW)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([] as never)

    const response = await apiRequest(`/v1/admin/items/${DELETED_ITEM_ROW.id}`, { token })

    const body = await response.json() as { item: { deletedAt: string | null } }
    expect(response.status).toBe(200)
    expect(body.item.deletedAt).not.toBeNull()
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
})

describe('PATCH /v1/admin/items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with updated item when patching name', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockUpdateItem({ ...ITEM_ROW, name: 'Updated Name' })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Updated Name' },
    })

    const body = await response.json() as { item: { name: string } }
    expect(response.status).toBe(200)
    expect(body.item.name).toBe('Updated Name')
  })

  it('returns 200 when patching moderationStatus', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockUpdateItem({ ...ITEM_ROW, moderationStatus: 'rejected' })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { moderationStatus: 'rejected' },
    })

    const body = await response.json() as { item: { moderationStatus: string } }
    expect(response.status).toBe(200)
    expect(body.item.moderationStatus).toBe('rejected')
  })

  it('logs with url fields redacted in changes diff', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById({ ...ITEM_ROW, imageUrl: 'https://old.example.com/img.jpg' })
    mockUpdateItem({ ...ITEM_ROW, imageUrl: 'https://new.example.com/img.jpg' })

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

  it('returns 422 when moderationStatus is invalid enum value', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { moderationStatus: 'banned' },
    })

    expect(response.status).toBe(422)
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
})

describe('DELETE /v1/admin/items/:id (soft delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with soft-deleted item when no list_items reference it', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockDeleteTransaction(0, { ...ITEM_ROW, deletedAt: new Date() })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    const body = await response.json() as { item: { deletedAt: string | null } }
    expect(response.status).toBe(200)
    expect(body.item.deletedAt).not.toBeNull()
  })

  it('returns 409 when list_items reference the item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockDeleteTransaction(3, ITEM_ROW)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    const body = await response.json() as { code: string; metadata: { message: string } }
    expect(response.status).toBe(409)
    expect(body.metadata.message).toContain('3')
  })

  it('logs at warn level on successful soft-delete', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockDeleteTransaction(0, { ...ITEM_ROW, deletedAt: new Date() })

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

describe('POST /v1/admin/items/:id/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with restored item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(DELETED_ITEM_ROW)
    mockUpdateItem({ ...DELETED_ITEM_ROW, deletedAt: null })

    const response = await apiRequest(`/v1/admin/items/${DELETED_ITEM_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    const body = await response.json() as { item: { deletedAt: null } }
    expect(response.status).toBe(200)
    expect(body.item.deletedAt).toBeNull()
  })

  it('returns 404 when item is not soft-deleted (live item)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 when item does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(undefined)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('logs at info level on successful restore', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(DELETED_ITEM_ROW)
    mockUpdateItem({ ...DELETED_ITEM_ROW, deletedAt: null })

    await apiRequest(`/v1/admin/items/${DELETED_ITEM_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_restore_item' }),
    )
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    expect(response.status).toBe(403)
  })
})

describe('GET /v1/admin/items/:id/sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with sources for live item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([SOURCE_ROW] as never)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, { token })

    const body = await response.json() as { sources: unknown[] }
    expect(response.status).toBe(200)
    expect(body.sources).toHaveLength(1)
  })

  it('returns 200 with sources for soft-deleted item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(DELETED_ITEM_ROW)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([] as never)

    const response = await apiRequest(`/v1/admin/items/${DELETED_ITEM_ROW.id}/sources`, { token })

    expect(response.status).toBe(200)
  })

  it('returns 404 when item does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(undefined)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, { token })
    expect(response.status).toBe(404)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, { token })
    expect(response.status).toBe(403)
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

    vi.mocked(db.transaction).mockImplementationOnce((callback) => {
      const tx = {
        insert: vi.fn().mockReturnValueOnce({
          values: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([SOURCE_ROW]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        delete: vi.fn(),
        select: vi.fn(),
      }
      return callback(tx as never) as never
    })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { currency: 'EUR', isPrimary: false },
    })

    const body = await response.json() as { source: { itemId: string } }
    expect(response.status).toBe(201)
    expect(body.source.itemId).toBe(ITEM_ROW.id)
  })

  it('returns 404 when parent item is soft-deleted', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(undefined)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { currency: 'EUR', isPrimary: false },
    })

    expect(response.status).toBe(404)
  })

  it('demotes existing primary when isPrimary=true', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)

    const demoteUpdateMock = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    })
    const insertMock = vi.fn().mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{ ...SOURCE_ROW, isPrimary: true }]),
      }),
    })
    const setMock = vi.fn().mockReturnValueOnce(demoteUpdateMock())
    const updateMock = vi.fn().mockReturnValueOnce({ set: setMock })

    vi.mocked(db.transaction).mockImplementationOnce((callback) => {
      const tx = {
        insert: insertMock,
        update: updateMock,
        delete: vi.fn(),
        select: vi.fn(),
      }
      return callback(tx as never) as never
    })

    await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { isPrimary: true },
    })

    expect(updateMock).toHaveBeenCalledOnce()
  })

  it('returns 404 when shopId does not exist or is inactive', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    vi.mocked(db.query.shops.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { shopId: SHOP_ROW.id, isPrimary: false },
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

    vi.mocked(db.transaction).mockImplementationOnce((callback) => {
      const tx = {
        insert: vi.fn().mockReturnValueOnce({
          values: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([SOURCE_ROW]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }),
        }),
        delete: vi.fn(),
        select: vi.fn(),
      }
      return callback(tx as never) as never
    })

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

    vi.mocked(db.transaction).mockImplementationOnce((callback) => {
      const tx = {
        update: vi.fn().mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([{ ...SOURCE_ROW, currency: 'USD' }]),
            }),
          }),
        }),
        insert: vi.fn(),
        delete: vi.fn(),
        select: vi.fn(),
      }
      return callback(tx as never) as never
    })

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { currency: 'USD' },
      },
    )

    const body = await response.json() as { source: { currency: string } }
    expect(response.status).toBe(200)
    expect(body.source.currency).toBe('USD')
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
})

describe('DELETE /v1/admin/items/:id/sources/:sourceId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with success message', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([SOURCE_ROW]),
      }),
    } as never)

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      { method: 'DELETE', token },
    )

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toContain('deleted')
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
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([SOURCE_ROW]),
      }),
    } as never)

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
