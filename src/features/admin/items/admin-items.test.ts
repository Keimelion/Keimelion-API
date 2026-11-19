import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { apiMultipartRequest, apiRequest } from '../../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../../shared/test/auth.js'
import { ADMIN_USER_FIXTURE as ADMIN_USER, makeAdminUser } from '../../../shared/test/fixtures/users.js'
import { logger } from '../../../shared/utils/logger.js'
import {
  adminItemsCreateResponseSchema,
  adminItemsCreateSourceResponseSchema,
  adminItemsGetResponseSchema,
  adminItemsListResponseSchema,
  adminItemsUpdateResponseSchema,
  adminItemsUpdateSourceResponseSchema,
  MAX_CATEGORIES_PER_ITEM,
  messageResponseSchema,
} from '@keimelion/sdk/schemas'
import { images } from '../../../db/entities/images/images.schema.js'
import { ITEMS_GTIN_UNIQUE_INDEX } from '../../../db/entities/items/items.schema.js'
import { itemContributions } from '../../../db/entities/item-contributions/item-contributions.schema.js'
import {
  ITEM_SOURCES_ITEM_SHOP_UNIQUE_INDEX,
  ITEM_SOURCES_SOURCE_URL_UNIQUE_INDEX,
} from '../../../db/entities/item-sources/item-sources.schema.js'
import { amazonUrlStrategy } from '../../affiliate/strategies/amazon.strategy.js'

const { mockProcessImage } = vi.hoisted(() => ({ mockProcessImage: vi.fn() }))

vi.mock('../../uploads/image.pipeline.js', () => ({ processImage: mockProcessImage }))

vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))


const NON_ADMIN_USER = makeAdminUser({
  id: '00000000-0000-0000-0000-000000000002',
  email: 'user@example.com',
  role: 'user',
})

const ITEM_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Test Item',
  description: 'A test item',
  gtin: null,
  imageId: null,
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

const CATEGORY_ONE = {
  id: '00000000-0000-0000-0000-000000000040',
  parentId: null,
  slug: 'electronics',
  depth: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  translations: [
    { categoryId: '00000000-0000-0000-0000-000000000040', locale: 'en' as const, name: 'Electronics' },
    { categoryId: '00000000-0000-0000-0000-000000000040', locale: 'fr' as const, name: 'Électronique' },
  ],
}

const CATEGORY_TWO = {
  ...CATEGORY_ONE,
  id: '00000000-0000-0000-0000-000000000041',
  slug: 'mode',
  translations: [
    { categoryId: '00000000-0000-0000-0000-000000000041', locale: 'en' as const, name: 'Mode' },
    { categoryId: '00000000-0000-0000-0000-000000000041', locale: 'fr' as const, name: 'Mode' },
  ],
}

const TAG_ONE = {
  id: '00000000-0000-0000-0000-000000000050',
  name: 'premium',
  slug: 'premium',
  createdByUserId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const TAG_TWO = {
  ...TAG_ONE,
  id: '00000000-0000-0000-0000-000000000051',
  name: 'exclusive',
  slug: 'exclusive',
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(ADMIN_USER.id)

function mockAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
}

function mockNonAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(
    makeAccessTokenEntry(NON_ADMIN_USER.id),
  )
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(NON_ADMIN_USER)
}

function mockFindItemById(row: unknown): void {
  vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(row as never)
}

function mockLockedItem(row: unknown): void {
  vi.mocked(db.select).mockReturnValueOnce(buildLockedItemChain(row) as never)
}

function buildLockedItemChain(row: unknown): object {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    for: vi.fn().mockResolvedValueOnce([row]),
  }
}

function mockExistingItem(row: unknown): void {
  mockFindItemById(row)
  mockLockedItem(row)
}

function mockFindItemSourceById(row: unknown): void {
  vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(row as never)
}

function mockFindItemSourceByIdWithShop(row: unknown, shop: unknown): void {
  const rowOut =
    row === undefined || row === null
      ? undefined
      : { ...(row), shop }
  vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(rowOut as never)
}

const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

function pgError(code: string, constraintName?: string): Error {
  return Object.assign(new Error('postgres error'), { code, constraint_name: constraintName })
}

const SHOP_ALREADY_ON_ITEM = pgError(UNIQUE_VIOLATION, ITEM_SOURCES_ITEM_SHOP_UNIQUE_INDEX)
const SOURCE_URL_HELD = pgError(UNIQUE_VIOLATION, ITEM_SOURCES_SOURCE_URL_UNIQUE_INDEX)

function mockInsertItemSourceRejected(error: Error): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockRejectedValueOnce(error),
    }),
  } as never)
}

function mockUpdateItemSourceRejected(error: Error): void {
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

function itemWithCategoryLinks(categories: (typeof CATEGORY_ONE)[]): typeof ITEM_ROW & {
  sources: SourceRow[]
  itemCategories: { itemId: string; categoryId: string; assignedAt: Date; category: typeof CATEGORY_ONE }[]
  itemTags: never[]
} {
  return {
    ...ITEM_ROW,
    sources: [],
    itemCategories: categories.map((category) => ({
      itemId: ITEM_ROW.id,
      categoryId: category.id,
      assignedAt: new Date('2024-01-01'),
      category,
    })),
    itemTags: [],
  }
}

function itemWithTagLinks(tagRows: (typeof TAG_ONE)[]): typeof ITEM_ROW & {
  sources: SourceRow[]
  itemCategories: never[]
  itemTags: { itemId: string; tagId: string; assignedAt: Date; tag: typeof TAG_ONE }[]
} {
  return {
    ...ITEM_ROW,
    sources: [],
    itemCategories: [],
    itemTags: tagRows.map((tag) => ({
      itemId: ITEM_ROW.id,
      tagId: tag.id,
      assignedAt: new Date('2024-01-01'),
      tag,
    })),
  }
}

function mockPatchTagsTransaction(tagRows: (typeof TAG_ONE)[]): void {
  vi.mocked(db.transaction).mockImplementationOnce((callback) => {
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockResolvedValue([ITEM_ROW]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([ITEM_ROW]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      select: vi.fn().mockReturnValueOnce(buildLockedItemChain(ITEM_ROW)),
      query: { tags: { findMany: vi.fn().mockResolvedValue(tagRows) } },
    }
    return callback(tx as never)
  })
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

function mockCreateItemTransaction(
  itemRow: unknown,
  sourceRows: unknown[],
  tagRows: unknown[] = [],
): void {
  vi.mocked(db.transaction).mockImplementationOnce((callback) => {
    const insertMock = buildTxInsertMock([itemRow, ...sourceRows])
    // Fallback for extra inserts (itemCategories, tags upsert, item_tags).
    insertMock.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })
    const tx = {
      insert: insertMock,
      update: vi.fn(),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      select: vi.fn(),
      query: { tags: { findMany: vi.fn().mockResolvedValue(tagRows) } },
    }
    return callback(tx as never)
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

function mockReservationCountsByItemIds(counts = new Map<string, number>()): void {
  const rows = Array.from(counts, ([itemId, total]) => ({ itemId, total }))
  const chain = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockResolvedValueOnce(rows),
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
    return callback(tx as never)
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
    return callback(tx as never)
  })
  return { deleteCall }
}

describe('POST /v1/admin/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
    adminItemsCreateResponseSchema.parse(body)
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

  it('returns 422 when imageUrl is sent (external image URLs are not accepted)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Test',
        imageUrl: 'https://example.com/image.jpg',
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

  it('inserts category links and returns hydrated categories when categories are provided', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE, CATEGORY_TWO] as never)
    mockCreateItemTransaction(ITEM_ROW, [SOURCE_ROW])
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(
      {
        ...ITEM_ROW,
        sources: [SOURCE_ROW],
        itemCategories: [
          { itemId: ITEM_ROW.id, categoryId: CATEGORY_ONE.id, assignedAt: new Date(), category: CATEGORY_ONE },
          { itemId: ITEM_ROW.id, categoryId: CATEGORY_TWO.id, assignedAt: new Date(), category: CATEGORY_TWO },
        ],
        itemTags: [],
      } as never,
    )

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Test Item',
        sources: [{ currency: 'EUR' }],
        categories: [CATEGORY_ONE.id, CATEGORY_TWO.id],
      },
    })

    const body = await response.json() as { item: { categories: { slug: string }[] } }
    expect(response.status).toBe(201)
    expect(body.item.categories.map((category) => category.slug)).toEqual(
      expect.arrayContaining(['electronics', 'mode']),
    )
  })

  it('returns 404 CATEGORY_NOT_FOUND when a provided category UUID does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Test Item',
        sources: [{ currency: 'EUR' }],
        categories: [CATEGORY_ONE.id, CATEGORY_TWO.id],
      },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
  })

  it('returns 422 when categories contains a non-UUID string', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Test Item',
        sources: [{ currency: 'EUR' }],
        categories: ['not-a-uuid'],
      },
    })

    expect(response.status).toBe(422)
  })

  it(`returns 422 when categories exceeds max count (${String(MAX_CATEGORIES_PER_ITEM)})`, async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    const tooMany = Array.from(
      { length: MAX_CATEGORIES_PER_ITEM + 1 },
      (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    )

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Test Item',
        sources: [{ currency: 'EUR' }],
        categories: tooMany,
      },
    })

    expect(response.status).toBe(422)
  })

  it('creates an item with tags and returns the hydrated item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockCreateItemTransaction(ITEM_ROW, [SOURCE_ROW], [TAG_ONE, TAG_TWO])
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWithTagLinks([TAG_ONE, TAG_TWO]))

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Premium Item',
        sources: [{ currency: 'EUR' }],
        tags: ['premium', 'exclusive'],
      },
    })

    const body = await response.json() as { item: { tags: { slug: string }[] } }
    expect(response.status).toBe(201)
    expect(body.item.tags.map((tag) => tag.slug)).toEqual(
      expect.arrayContaining(['premium', 'exclusive']),
    )
  })

  it('returns 422 TAG_INVALID_NAME on create when a tag normalizes to an empty slug', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Test Item',
        sources: [{ currency: 'EUR' }],
        tags: ['!!!'],
      },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('TAG_INVALID_NAME')
  })

  it('returns 422 on create when tags exceeds max count (20)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: {
        name: 'Test Item',
        sources: [{ currency: 'EUR' }],
        tags: Array.from({ length: 21 }, (_, i) => `tag-${String(i)}`),
      },
    })

    expect(response.status).toBe(422)
  })
})

describe('GET /v1/admin/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 with paginated items including sources array on each item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([SOURCE_ROW])] as never)
    mockCountChain(1)
    mockReservationCountsByItemIds()

    const response = await apiRequest('/v1/admin/items', { token })

    const body = await response.json() as {
      items: { name: string; sources: { itemId: string }[] }[]
      pagination: { total: number }
    }
    adminItemsListResponseSchema.parse(body)
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
    mockReservationCountsByItemIds()

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
    mockReservationCountsByItemIds()

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
    mockReservationCountsByItemIds()

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
    mockReservationCountsByItemIds()

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
    mockReservationCountsByItemIds()

    const response = await apiRequest('/v1/admin/items', { token })
    expect(response.status).toBe(200)
  })

  it('filters by id[eq]', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)
    mockReservationCountsByItemIds()

    const response = await apiRequest('/v1/admin/items?id%5Beq%5D=11111111-1111-1111-1111-111111111111', { token })
    expect(response.status).toBe(200)
  })

  it('filters by name[ilike]', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)
    mockReservationCountsByItemIds()

    const response = await apiRequest('/v1/admin/items?name%5Bilike%5D=test', { token })
    expect(response.status).toBe(200)
  })

  it('filters by createdByUserId[isNull]=true (catalog-only items)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)
    mockReservationCountsByItemIds()

    const response = await apiRequest('/v1/admin/items?createdByUserId%5BisNull%5D=true', { token })
    expect(response.status).toBe(200)
  })

  it('sorts by name:asc', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)
    mockReservationCountsByItemIds()

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
  const CONTRIBUTOR = { id: '00000000-0000-0000-0000-000000000060', username: 'filler' }
  const NEWEST_CONTRIBUTION = {
    id: '00000000-0000-0000-0000-000000000061',
    itemId: ITEM_ROW.id,
    userId: ADMIN_USER.id,
    action: 'admin_update' as const,
    changes: { name: { from: 'Old name', to: 'Test Item' } },
    createdAt: new Date('2024-03-01'),
    user: { id: ADMIN_USER.id, username: ADMIN_USER.username },
  }
  const OLDER_CONTRIBUTION = {
    id: '00000000-0000-0000-0000-000000000062',
    itemId: ITEM_ROW.id,
    userId: CONTRIBUTOR.id,
    action: 'fill' as const,
    changes: { description: { from: null, to: 'A test item' } },
    createdAt: new Date('2024-02-01'),
    user: CONTRIBUTOR,
  }
  const DELETED_USER_CONTRIBUTION = {
    ...OLDER_CONTRIBUTION,
    id: '00000000-0000-0000-0000-000000000063',
    userId: null,
    createdAt: new Date('2024-01-15'),
    user: null,
  }

  function itemWithContributions(sources: SourceRow[], contributions: object[] = []): object {
    return { ...itemWith(sources), contributions }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 with item, sources and reservationCount', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(itemWithContributions([SOURCE_ROW]))
    mockReservationCountsByItemIds(new Map([[ITEM_ROW.id, 3]]))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, { token })

    const body = await response.json() as {
      item: Record<string, unknown> & {
        name: string
        sources: unknown[]
        reservationCount: number
        contributions: unknown[]
      }
    }
    adminItemsGetResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.item.name).toBe('Test Item')
    expect(body.item.sources).toHaveLength(1)
    expect(body.item.reservationCount).toBe(3)
    expect(body.item).not.toHaveProperty('reservations')
    expect(body.item.contributions).toEqual([])
  })

  it('embeds the contributions newest first with the contributor id and username', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(
      itemWithContributions([], [NEWEST_CONTRIBUTION, OLDER_CONTRIBUTION, DELETED_USER_CONTRIBUTION]),
    )
    mockReservationCountsByItemIds()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, { token })

    const body = adminItemsGetResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.item.createdByUserId).toBeNull()
    expect(body.item.contributions).toEqual([
      {
        id: NEWEST_CONTRIBUTION.id,
        action: 'admin_update',
        changes: NEWEST_CONTRIBUTION.changes,
        user: { id: ADMIN_USER.id, username: ADMIN_USER.username },
        createdAt: NEWEST_CONTRIBUTION.createdAt,
      },
      {
        id: OLDER_CONTRIBUTION.id,
        action: 'fill',
        changes: OLDER_CONTRIBUTION.changes,
        user: CONTRIBUTOR,
        createdAt: OLDER_CONTRIBUTION.createdAt,
      },
      {
        id: DELETED_USER_CONTRIBUTION.id,
        action: 'fill',
        changes: DELETED_USER_CONTRIBUTION.changes,
        user: null,
        createdAt: DELETED_USER_CONTRIBUTION.createdAt,
      },
    ])
  })

  it('loads the contributions newest first in the item query with only the user id and username', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(itemWithContributions([]))
    mockReservationCountsByItemIds()

    await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, { token })

    const query = vi.mocked(db.query.items.findFirst).mock.calls[0]?.[0] as {
      with: { contributions: { orderBy: SQL[]; with: { user: { columns: Record<string, boolean> } } } }
    }
    const orderBy = query.with.contributions.orderBy.map((clause) => new PgDialect().sqlToQuery(clause).sql)
    expect(orderBy).toEqual(['"item_contributions"."created_at" desc', '"item_contributions"."id" desc'])
    expect(query.with.contributions.with.user.columns).toEqual({ id: true, username: true })
  })

  it('does not embed the contributions in the paginated admin items list', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountChain(1)
    mockReservationCountsByItemIds()

    const response = await apiRequest('/v1/admin/items', { token })

    const body = await response.json() as { items: Record<string, unknown>[] }
    expect(response.status).toBe(200)
    expect(body.items[0]).not.toHaveProperty('contributions')
  })

  it('does not expose deletedAt on item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(itemWithContributions([]))
    mockReservationCountsByItemIds()

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
  const PATCH_EAN_13 = '4006381333931'
  const PATCH_PADDED_GTIN = '04006381333931'

  function mockInsertContribution(): ReturnType<typeof vi.fn> {
    const values = vi.fn().mockResolvedValue(undefined)
    vi.mocked(db.insert).mockReturnValueOnce({ values } as never)
    return values
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 with updated item (with sources) when patching name', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem(ITEM_ROW)
    mockUpdateItem({ ...ITEM_ROW, name: 'Updated Name' })
    mockFindItemById({ ...itemWith([SOURCE_ROW]), name: 'Updated Name' })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Updated Name' },
    })

    const body = await response.json() as { item: { name: string; sources: unknown[] } }
    adminItemsUpdateResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.item.name).toBe('Updated Name')
    expect(body.item.sources).toHaveLength(1)
  })

  it('logs one admin_update contribution with the admin id and the from/to of the changed fields', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem(ITEM_ROW)
    mockUpdateItem({ ...ITEM_ROW, name: 'Updated Name', gtin: PATCH_PADDED_GTIN })
    const contributionValues = mockInsertContribution()
    mockFindItemById({ ...itemWith([]), name: 'Updated Name', gtin: PATCH_PADDED_GTIN })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Updated Name', description: ITEM_ROW.description, gtin: PATCH_EAN_13 },
    })

    expect(response.status).toBe(200)
    expect(vi.mocked(db.insert)).toHaveBeenCalledWith(itemContributions)
    expect(contributionValues).toHaveBeenCalledTimes(1)
    expect(contributionValues).toHaveBeenCalledWith({
      itemId: ITEM_ROW.id,
      userId: ADMIN_USER.id,
      action: 'admin_update',
      changes: {
        name: { from: 'Test Item', to: 'Updated Name' },
        gtin: { from: null, to: PATCH_PADDED_GTIN },
      },
    })
  })

  it('takes the from values of the admin_update from the row locked in the transaction', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById({ ...ITEM_ROW, description: null })
    mockLockedItem({ ...ITEM_ROW, description: 'Filled concurrently' })
    mockUpdateItem({ ...ITEM_ROW, description: 'Moderated' })
    const contributionValues = mockInsertContribution()
    mockFindItemById({ ...itemWith([]), description: 'Moderated' })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { description: 'Moderated' },
    })

    expect(response.status).toBe(200)
    expect(contributionValues).toHaveBeenCalledWith(expect.objectContaining({
      changes: { description: { from: 'Filled concurrently', to: 'Moderated' } },
    }))
  })

  it('logs nothing when the PATCH sets every field to its current value', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem(ITEM_ROW)
    mockUpdateItem(ITEM_ROW)
    mockFindItemById(itemWith([]))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: ITEM_ROW.name, description: ITEM_ROW.description, gtin: null },
    })

    expect(response.status).toBe(200)
    expect(vi.mocked(db.insert)).not.toHaveBeenCalledWith(itemContributions)
  })

  it('logs nothing on a categories-only PATCH', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem(ITEM_ROW)
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWithCategoryLinks([CATEGORY_ONE]))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { categories: [CATEGORY_ONE.id] },
    })

    expect(response.status).toBe(200)
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    expect(vi.mocked(db.insert)).not.toHaveBeenCalledWith(itemContributions)
  })

  it('logs nothing and returns 409 when the PATCH write fails on the GTIN unique index', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem(ITEM_ROW)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(pgError(UNIQUE_VIOLATION, ITEMS_GTIN_UNIQUE_INDEX)),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { gtin: PATCH_EAN_13 },
    })

    expect(response.status).toBe(409)
    expect(vi.mocked(db.insert)).not.toHaveBeenCalledWith(itemContributions)
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

  it('returns 422 when imageUrl is sent (external image URLs are not accepted)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { imageUrl: 'https://example.com/img.jpg' },
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

  it('replaces categories when categories are provided', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem(ITEM_ROW)
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE, CATEGORY_TWO] as never)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(
      itemWithCategoryLinks([CATEGORY_ONE, CATEGORY_TWO]),
    )

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { categories: [CATEGORY_ONE.id, CATEGORY_TWO.id] },
    })

    const body = await response.json() as { item: { categories: { slug: string }[] } }
    expect(response.status).toBe(200)
    expect(body.item.categories.map((category) => category.slug)).toEqual(
      expect.arrayContaining(['electronics', 'mode']),
    )
  })

  it('clears all categories when categories: [] is sent', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem(ITEM_ROW)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWithCategoryLinks([]))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { categories: [] },
    })

    const body = await response.json() as { item: { categories: unknown[] } }
    expect(response.status).toBe(200)
    expect(body.item.categories).toEqual([])
  })

  it('returns 404 CATEGORY_NOT_FOUND when a category UUID does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { categories: [CATEGORY_ONE.id, CATEGORY_TWO.id] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
  })

  it('accepts a categories-only patch (no scalar fields)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem(ITEM_ROW)
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(
      itemWithCategoryLinks([CATEGORY_ONE]),
    )

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { categories: [CATEGORY_ONE.id] },
    })

    const body = await response.json() as { item: { categories: { slug: string }[] } }
    expect(response.status).toBe(200)
    expect(body.item.categories.map((category) => category.slug)).toEqual(['electronics'])
  })

  it(`returns 422 when categories exceeds max count (${String(MAX_CATEGORIES_PER_ITEM)})`, async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    const tooMany = Array.from(
      { length: MAX_CATEGORIES_PER_ITEM + 1 },
      (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    )

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { categories: tooMany },
    })

    expect(response.status).toBe(422)
  })

  it('replaces tags when tags are provided', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockPatchTagsTransaction([TAG_ONE, TAG_TWO])
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWithTagLinks([TAG_ONE, TAG_TWO]))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: ['premium', 'exclusive'] },
    })

    const body = await response.json() as { item: { tags: { slug: string }[] } }
    expect(response.status).toBe(200)
    expect(body.item.tags.map((tag) => tag.slug)).toEqual(
      expect.arrayContaining(['premium', 'exclusive']),
    )
  })

  it('clears all tags when tags: [] is sent', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockPatchTagsTransaction([])
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWithTagLinks([]))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: [] },
    })

    const body = await response.json() as { item: { tags: unknown[] } }
    expect(response.status).toBe(200)
    expect(body.item.tags).toEqual([])
  })

  it('accepts a tags-only patch (no scalar fields, no categories)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)
    mockPatchTagsTransaction([TAG_ONE])
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWithTagLinks([TAG_ONE]))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: ['premium'] },
    })

    const body = await response.json() as { item: { tags: { slug: string }[] } }
    expect(response.status).toBe(200)
    expect(body.item.tags.map((tag) => tag.slug)).toEqual(['premium'])
  })

  it('returns 422 TAG_INVALID_NAME on PATCH when a tag normalizes to an empty slug', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemById(ITEM_ROW)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: ['!!!'] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('TAG_INVALID_NAME')
  })

  it('returns 422 on PATCH when tags exceeds max count (20)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: Array.from({ length: 21 }, (_, i) => `tag-${String(i)}`) },
    })

    expect(response.status).toBe(422)
  })
})

describe('DELETE /v1/admin/items/:id (hard delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
    messageResponseSchema.parse(body)
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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 201 with created source', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertItemSource(SOURCE_ROW)
    mockFindItemSourceByIdWithShop(SOURCE_ROW, null)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { currency: 'EUR' },
    })

    const body = await response.json() as { source: { itemId: string; shop: unknown } }
    adminItemsCreateSourceResponseSchema.parse(body)
    expect(response.status).toBe(201)
    expect(body.source.itemId).toBe(ITEM_ROW.id)
    expect(body.source.shop).toBeNull()
  })

  it('returns 201 with embedded shop when shopId is provided', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertItemSource(SOURCE_WITH_SHOP_ROW)
    mockFindItemSourceByIdWithShop(SOURCE_WITH_SHOP_ROW, SHOP_ROW)

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
    mockInsertItemSourceRejected(pgError(FOREIGN_KEY_VIOLATION))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { currency: 'EUR' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 when shopId does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertItemSourceRejected(pgError(FOREIGN_KEY_VIOLATION))

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

  it('returns 422 when currency is not a supported ISO code (lowercase)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { currency: 'eur' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when currency is a valid-format but unsupported ISO code', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { currency: 'XYZ' },
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
    mockInsertItemSource(SOURCE_ROW)
    mockFindItemSourceByIdWithShop(SOURCE_ROW, null)

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

  it('returns 409 DUPLICATE_SHOP_FOR_ITEM when the DB unique index rejects the insert', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertItemSourceRejected(SHOP_ALREADY_ON_ITEM)

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
})

describe('PATCH /v1/admin/items/:id/sources/:sourceId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
    adminItemsUpdateSourceResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.source.currency).toBe('USD')
    expect(body.source.shop).toBeNull()
  })

  it('embeds the updated shop when shopId is patched to a valid shop', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
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

  it('returns 409 DUPLICATE_SHOP_FOR_ITEM when the DB unique index rejects the update', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockUpdateItemSourceRejected(SHOP_ALREADY_ON_ITEM)

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

  it('returns 404 when the patched shopId does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockUpdateItemSourceRejected(pgError(FOREIGN_KEY_VIOLATION))

    const response = await apiRequest(
      `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`,
      {
        method: 'PATCH',
        token,
        body: { shopId: SHOP_ROW.id },
      },
    )

    expect(response.status).toBe(404)
  })
})

describe('DELETE /v1/admin/items/:id/sources/:sourceId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
    messageResponseSchema.parse(body)
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

describe('admin items — image upload', () => {
  const NEW_IMAGE_ROW = {
    id: '00000000-0000-0000-0000-00000000c001',
    hash: 'c'.repeat(64),
    fileKey: 'cc/cc/' + 'c'.repeat(64),
    mime: 'image/png',
    sizeBytes: 4,
    width: 640,
    height: 480,
    uploadedBy: ADMIN_USER.id,
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-05-01'),
  }
  const PREVIOUS_IMAGE_ID = '00000000-0000-0000-0000-00000000c000'
  const IMAGE_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  const ITEM_PATH = `/v1/admin/items/${ITEM_ROW.id}`

  interface ImageBody {
    item: { imageId: string | null; image: { id: string; urls: { md: string } } | null }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
    mockProcessImage.mockResolvedValue({ image: NEW_IMAGE_ROW })
  })

  it('creates an item with an uploaded image and JSON-encoded sources (multipart)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    const createdRow = { ...ITEM_ROW, imageId: NEW_IMAGE_ROW.id }
    mockCreateItemTransaction(createdRow, [SOURCE_ROW])
    mockFindItemById({ ...itemWith([SOURCE_ROW]), imageId: NEW_IMAGE_ROW.id, image: NEW_IMAGE_ROW })

    const response = await apiMultipartRequest('/v1/admin/items', {
      method: 'POST',
      token,
      fields: { name: 'Test Item', sources: JSON.stringify([{ currency: 'EUR' }]) },
      image: { buffer: IMAGE_BUFFER },
    })

    const body = await response.json() as ImageBody
    adminItemsCreateResponseSchema.parse(body)
    expect(response.status).toBe(201)
    expect(body.item.imageId).toBe(NEW_IMAGE_ROW.id)
    expect(body.item.image?.urls.md).toContain('-800.webp')
    expect(mockProcessImage).toHaveBeenCalledWith(expect.any(Buffer), ADMIN_USER.id)
  })

  it('returns 422 when multipart sources is not valid JSON', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiMultipartRequest('/v1/admin/items', {
      method: 'POST',
      token,
      fields: { name: 'Test Item', sources: 'not-json' },
      image: { buffer: IMAGE_BUFFER },
    })

    expect(response.status).toBe(422)
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('deletes the new images row when the create transaction fails', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockCreateItemTransactionFailure()

    const response = await apiMultipartRequest('/v1/admin/items', {
      method: 'POST',
      token,
      fields: { name: 'Test Item', sources: JSON.stringify([{ currency: 'EUR' }]) },
      image: { buffer: IMAGE_BUFFER },
    })

    expect(response.status).toBe(500)
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
  })

  it('replaces the image and deletes the previous images row', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    const updatedRow = { ...ITEM_ROW, imageId: NEW_IMAGE_ROW.id }
    mockExistingItem({ ...ITEM_ROW, imageId: PREVIOUS_IMAGE_ID })
    mockUpdateItem(updatedRow)
    mockFindItemById({ ...itemWith([]), imageId: NEW_IMAGE_ROW.id, image: NEW_IMAGE_ROW })

    const response = await apiMultipartRequest(ITEM_PATH, { method: 'PATCH', token, image: { buffer: IMAGE_BUFFER } })

    const body = await response.json() as ImageBody
    expect(response.status).toBe(200)
    expect(body.item.imageId).toBe(NEW_IMAGE_ROW.id)
    expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
    const contributionValues = vi.mocked(db.insert).mock.results[0]?.value as { values: ReturnType<typeof vi.fn> }
    expect(vi.mocked(db.insert)).toHaveBeenCalledWith(itemContributions)
    expect(contributionValues.values).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin_update',
      changes: { imageId: { from: PREVIOUS_IMAGE_ID, to: NEW_IMAGE_ROW.id } },
    }))
  })

  it('clears the image with clearImage=true and deletes the previous images row', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem({ ...ITEM_ROW, imageId: PREVIOUS_IMAGE_ID })
    mockUpdateItem(ITEM_ROW)
    mockFindItemById(itemWith([]))

    const response = await apiRequest(ITEM_PATH, { method: 'PATCH', token, body: { clearImage: true } })

    const body = await response.json() as ImageBody
    expect(response.status).toBe(200)
    expect(body.item.imageId).toBeNull()
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('returns 422 IMAGE_AND_CLEAR_CONFLICT when an image and clearImage=true are both sent', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiMultipartRequest(ITEM_PATH, {
      method: 'PATCH',
      token,
      fields: { clearImage: 'true' },
      image: { buffer: IMAGE_BUFFER },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('IMAGE_AND_CLEAR_CONFLICT')
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('deletes the item images row when the item is hard-deleted', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockHardDeleteTransaction(0, { ...ITEM_ROW, imageId: PREVIOUS_IMAGE_ID })

    const response = await apiRequest(ITEM_PATH, { method: 'DELETE', token })

    expect(response.status).toBe(200)
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
  })
})

describe('shop resolution from sourceUrl', () => {
  const AMAZON_FR_SHOP = {
    ...SHOP_ROW,
    id: '00000000-0000-0000-0000-000000000021',
    slug: 'amazon-fr',
    name: 'Amazon France',
    domain: 'amazon.fr',
  }
  const AMAZON_FR_URL = 'https://www.amazon.fr/dp/B000'

  function mockFindShopsByDomains(rows: unknown[]): void {
    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce(rows as never)
  }

  function mockInsertItemSourceRecordingValues(returnRow: unknown): ReturnType<typeof vi.fn> {
    const values = vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    })
    vi.mocked(db.insert).mockReturnValueOnce({ values } as never)
    return values
  }

  function mockUpdateItemSourceRecordingSet(returnRow: unknown): ReturnType<typeof vi.fn> {
    const set = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([returnRow]),
      }),
    })
    vi.mocked(db.update).mockReturnValueOnce({ set } as never)
    return set
  }

  function mockCreateItemTransactionRecordingValues(itemRow: unknown, sourceRows: unknown[]): ReturnType<typeof vi.fn> {
    const values = vi.fn()
    for (const row of [itemRow, ...sourceRows]) {
      values.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([row]) })
    }
    vi.mocked(db.transaction).mockImplementationOnce((callback) =>
      callback({ insert: vi.fn().mockReturnValue({ values }) } as never),
    )
    return values
  }

  function mockCreateItemTransactionRejected(error: Error): void {
    vi.mocked(db.transaction).mockRejectedValueOnce(error)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  describe('POST /v1/admin/items/:id/sources', () => {
    it('sets shopId from a subdomain of the shop domain', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindShopsByDomains([AMAZON_FR_SHOP])
      const insertedRow = { ...SOURCE_ROW, shopId: AMAZON_FR_SHOP.id, sourceUrl: AMAZON_FR_URL }
      const values = mockInsertItemSourceRecordingValues(insertedRow)
      mockFindItemSourceByIdWithShop(insertedRow, AMAZON_FR_SHOP)

      const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
        method: 'POST',
        token,
        body: { sourceUrl: AMAZON_FR_URL },
      })

      const body = adminItemsCreateSourceResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(values).toHaveBeenCalledWith(expect.objectContaining({ shopId: AMAZON_FR_SHOP.id }))
      expect(body.source.shop?.slug).toBe(AMAZON_FR_SHOP.slug)
    })

    it('prefers the most specific matching shop domain', async () => {
      const subdomainShop = {
        ...AMAZON_FR_SHOP,
        id: '00000000-0000-0000-0000-000000000022',
        slug: 'amazon-fr-mobile',
        domain: 'm.amazon.fr',
      }
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindShopsByDomains([AMAZON_FR_SHOP, subdomainShop])
      const values = mockInsertItemSourceRecordingValues({ ...SOURCE_ROW, shopId: subdomainShop.id })
      mockFindItemSourceByIdWithShop({ ...SOURCE_ROW, shopId: subdomainShop.id }, subdomainShop)

      const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
        method: 'POST',
        token,
        body: { sourceUrl: 'https://m.amazon.fr/dp/B000' },
      })

      expect(response.status).toBe(201)
      expect(values).toHaveBeenCalledWith(expect.objectContaining({ shopId: subdomainShop.id }))
    })

    it('ignores IP-literal hosts', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockInsertItemSource(SOURCE_ROW)
      mockFindItemSourceByIdWithShop(SOURCE_ROW, null)

      const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
        method: 'POST',
        token,
        body: { sourceUrl: 'https://10.0.0.1/x' },
      })

      expect(response.status).toBe(201)
      expect(vi.mocked(db.query.shops.findMany)).not.toHaveBeenCalled()
    })

    it('leaves shopId null and succeeds when no shop matches', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindShopsByDomains([])
      const values = mockInsertItemSourceRecordingValues({ ...SOURCE_ROW, sourceUrl: 'https://notamazon.fr/x' })
      mockFindItemSourceByIdWithShop({ ...SOURCE_ROW, sourceUrl: 'https://notamazon.fr/x' }, null)

      const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
        method: 'POST',
        token,
        body: { sourceUrl: 'https://notamazon.fr/x' },
      })

      const body = adminItemsCreateSourceResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(values).toHaveBeenCalledWith(expect.objectContaining({ shopId: null }))
      expect(body.source.shop).toBeNull()
    })

    it('does not look up shops by domain when sourceUrl is absent', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockInsertItemSource(SOURCE_ROW)
      mockFindItemSourceByIdWithShop(SOURCE_ROW, null)

      const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
        method: 'POST',
        token,
        body: { currency: 'EUR' },
      })

      expect(response.status).toBe(201)
      expect(vi.mocked(db.query.shops.findMany)).not.toHaveBeenCalled()
    })

    it('keeps an explicit shopId even when sourceUrl matches another shop', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindShopsByDomains([SHOP_ROW, AMAZON_FR_SHOP])
      const values = mockInsertItemSourceRecordingValues({ ...SOURCE_WITH_SHOP_ROW, sourceUrl: AMAZON_FR_URL })
      mockFindItemSourceByIdWithShop({ ...SOURCE_WITH_SHOP_ROW, sourceUrl: AMAZON_FR_URL }, SHOP_ROW)

      const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
        method: 'POST',
        token,
        body: { shopId: SHOP_ROW.id, sourceUrl: AMAZON_FR_URL },
      })

      expect(response.status).toBe(201)
      expect(values).toHaveBeenCalledWith(expect.objectContaining({ shopId: SHOP_ROW.id }))
    })

    it('returns 409 DUPLICATE_SHOP_FOR_ITEM when the resolved shop is already used on the item', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindShopsByDomains([AMAZON_FR_SHOP])
      mockInsertItemSourceRejected(SHOP_ALREADY_ON_ITEM)

      const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
        method: 'POST',
        token,
        body: { sourceUrl: AMAZON_FR_URL },
      })

      const body = await response.json() as { code: string }
      expect(response.status).toBe(409)
      expect(body.code).toBe('DUPLICATE_SHOP_FOR_ITEM')
    })
  })

  describe('PATCH /v1/admin/items/:id/sources/:sourceId', () => {
    it('resolves shopId from the new sourceUrl when the source has no shop', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindItemSourceById(SOURCE_ROW)
      mockFindShopsByDomains([AMAZON_FR_SHOP])
      const set = mockUpdateItemSourceRecordingSet({ ...SOURCE_ROW, shopId: AMAZON_FR_SHOP.id })
      mockFindItemSourceByIdWithShop({ ...SOURCE_ROW, shopId: AMAZON_FR_SHOP.id }, AMAZON_FR_SHOP)

      const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`, {
        method: 'PATCH',
        token,
        body: { sourceUrl: AMAZON_FR_URL },
      })

      const body = adminItemsUpdateSourceResponseSchema.parse(await response.json())
      expect(response.status).toBe(200)
      expect(set).toHaveBeenCalledWith({
        shopId: AMAZON_FR_SHOP.id,
        sourceUrl: AMAZON_FR_URL,
        originalUrl: AMAZON_FR_URL,
        affiliateUrl: null,
      })
      expect(body.source.shop?.slug).toBe(AMAZON_FR_SHOP.slug)
    })

    it('keeps the current shop when only sourceUrl changes', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindItemSourceById(SOURCE_WITH_SHOP_ROW)
      mockFindShopsByDomains([SHOP_ROW])
      const set = mockUpdateItemSourceRecordingSet({ ...SOURCE_WITH_SHOP_ROW, sourceUrl: 'https://amzn.to/abc' })
      mockFindItemSourceByIdWithShop({ ...SOURCE_WITH_SHOP_ROW, sourceUrl: 'https://amzn.to/abc' }, SHOP_ROW)

      const response = await apiRequest(
        `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_WITH_SHOP_ROW.id}`,
        { method: 'PATCH', token, body: { sourceUrl: 'https://amzn.to/abc' } },
      )

      expect(response.status).toBe(200)
      expect(set).toHaveBeenCalledWith({
        sourceUrl: 'https://amzn.to/abc',
        originalUrl: 'https://amzn.to/abc',
        affiliateUrl: null,
      })
    })

    it('keeps the current shop when sourceUrl is cleared', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindItemSourceById(SOURCE_WITH_SHOP_ROW)
      const set = mockUpdateItemSourceRecordingSet({ ...SOURCE_WITH_SHOP_ROW, sourceUrl: null })
      mockFindItemSourceByIdWithShop({ ...SOURCE_WITH_SHOP_ROW, sourceUrl: null }, SHOP_ROW)

      const response = await apiRequest(
        `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_WITH_SHOP_ROW.id}`,
        { method: 'PATCH', token, body: { sourceUrl: null } },
      )

      expect(response.status).toBe(200)
      expect(set).toHaveBeenCalledWith({ sourceUrl: null, originalUrl: null, affiliateUrl: null })
    })

    it('keeps the explicit shopId when both shopId and sourceUrl are sent', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindItemSourceById(SOURCE_ROW)
      mockFindShopsByDomains([SHOP_ROW, AMAZON_FR_SHOP])
      const set = mockUpdateItemSourceRecordingSet(SOURCE_WITH_SHOP_ROW)
      mockFindItemSourceByIdWithShop(SOURCE_WITH_SHOP_ROW, SHOP_ROW)

      const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`, {
        method: 'PATCH',
        token,
        body: { shopId: SHOP_ROW.id, sourceUrl: AMAZON_FR_URL },
      })

      expect(response.status).toBe(200)
      expect(set).toHaveBeenCalledWith({
        shopId: SHOP_ROW.id,
        sourceUrl: AMAZON_FR_URL,
        originalUrl: AMAZON_FR_URL,
        affiliateUrl: null,
      })
    })

    it('leaves shopId untouched when sourceUrl is not sent', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindItemSourceById(SOURCE_WITH_SHOP_ROW)
      const set = mockUpdateItemSourceRecordingSet({ ...SOURCE_WITH_SHOP_ROW, price: '10.00' })
      mockFindItemSourceByIdWithShop({ ...SOURCE_WITH_SHOP_ROW, price: '10.00' }, SHOP_ROW)

      const response = await apiRequest(
        `/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_WITH_SHOP_ROW.id}`,
        { method: 'PATCH', token, body: { price: '10.00' } },
      )

      expect(response.status).toBe(200)
      expect(set).toHaveBeenCalledWith({ price: '10.00' })
      expect(vi.mocked(db.query.shops.findMany)).not.toHaveBeenCalled()
    })

    it('returns 409 DUPLICATE_SHOP_FOR_ITEM when the resolved shop is used by another source', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindItemSourceById(SOURCE_ROW)
      mockFindShopsByDomains([AMAZON_FR_SHOP])
      mockUpdateItemSourceRejected(SHOP_ALREADY_ON_ITEM)

      const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`, {
        method: 'PATCH',
        token,
        body: { sourceUrl: AMAZON_FR_URL },
      })

      const body = await response.json() as { code: string }
      expect(response.status).toBe(409)
      expect(body.code).toBe('DUPLICATE_SHOP_FOR_ITEM')
    })
  })

  describe('POST /v1/admin/items', () => {
    it('resolves the shop of each source in a single lookup', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindShopsByDomains([AMAZON_FR_SHOP])
      const values = mockCreateItemTransactionRecordingValues(ITEM_ROW, [SOURCE_WITH_SHOP_ROW, SOURCE_ROW])
      mockFindItemById(itemWith([SOURCE_WITH_SHOP_ROW, SOURCE_ROW]))

      const response = await apiRequest('/v1/admin/items', {
        method: 'POST',
        token,
        body: {
          name: 'Test Item',
          sources: [{ sourceUrl: AMAZON_FR_URL }, { sourceUrl: 'https://notamazon.fr/x' }],
        },
      })

      expect(response.status).toBe(201)
      expect(vi.mocked(db.query.shops.findMany)).toHaveBeenCalledTimes(1)
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({ shopId: AMAZON_FR_SHOP.id, sourceUrl: AMAZON_FR_URL }),
      )
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({ shopId: null, sourceUrl: 'https://notamazon.fr/x' }),
      )
    })

    it('returns 409 DUPLICATE_SHOP_FOR_ITEM when two sources end up on the same shop', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockFindShopsByDomains([AMAZON_FR_SHOP])
      mockCreateItemTransactionRejected(SHOP_ALREADY_ON_ITEM)

      const response = await apiRequest('/v1/admin/items', {
        method: 'POST',
        token,
        body: {
          name: 'Test Item',
          sources: [{ shopId: AMAZON_FR_SHOP.id }, { sourceUrl: AMAZON_FR_URL }],
        },
      })

      const body = await response.json() as { code: string }
      expect(response.status).toBe(409)
      expect(body.code).toBe('DUPLICATE_SHOP_FOR_ITEM')
    })

    it('returns 404 when an explicit shopId does not exist', async () => {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      mockAdminAuth()
      mockCreateItemTransactionRejected(pgError(FOREIGN_KEY_VIOLATION))

      const response = await apiRequest('/v1/admin/items', {
        method: 'POST',
        token,
        body: { name: 'Test Item', sources: [{ shopId: SHOP_ROW.id }] },
      })

      expect(response.status).toBe(404)
    })
  })
})

describe('source URL normalization', () => {
  const AMAZON_SHOP = { ...SHOP_ROW, domain: 'amazon.fr' }
  const AMAZON_PRODUCT_URL = 'https://amazon.fr/Lampe-Design/dp/B08N5WRWNW/ref=sr_1_1?tag=other-21&utm_source=news#reviews'
  const AMAZON_CANONICAL_URL = 'https://www.amazon.fr/dp/B08N5WRWNW'
  const TRACKED_URL = 'https://shop.example/product?color=red&size=M,L&utm_campaign=spring&gclid=abc#top'
  const CLEAN_URL = 'https://shop.example/product?color=red&size=M,L'

  function mockFindShops(rows: unknown[]): void {
    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce(rows as never)
  }

  function mockInsertRecordingValues(returnRow: unknown): ReturnType<typeof vi.fn> {
    const values = vi.fn().mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([returnRow]) })
    vi.mocked(db.insert).mockReturnValueOnce({ values } as never)
    return values
  }

  function mockUpdateRecordingSet(returnRow: unknown): ReturnType<typeof vi.fn> {
    const set = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([returnRow]) }),
    })
    vi.mocked(db.update).mockReturnValueOnce({ set } as never)
    return set
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('stores the normalized URL and keeps the submitted one when no shop matches', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindShops([])
    const storedRow = { ...SOURCE_ROW, sourceUrl: CLEAN_URL, originalUrl: TRACKED_URL, affiliateUrl: null }
    const values = mockInsertRecordingValues(storedRow)
    mockFindItemSourceByIdWithShop(storedRow, null)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { sourceUrl: TRACKED_URL },
    })

    expect(response.status).toBe(201)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: null, sourceUrl: CLEAN_URL, originalUrl: TRACKED_URL, affiliateUrl: null }),
    )
  })

  it("applies the shop's strategy, which drops a third-party affiliate tag", async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindShops([AMAZON_SHOP])
    const storedRow = { ...SOURCE_WITH_SHOP_ROW, sourceUrl: AMAZON_CANONICAL_URL, originalUrl: AMAZON_PRODUCT_URL }
    const values = mockInsertRecordingValues(storedRow)
    mockFindItemSourceByIdWithShop(storedRow, AMAZON_SHOP)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { sourceUrl: AMAZON_PRODUCT_URL },
    })

    expect(response.status).toBe(201)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: AMAZON_SHOP.id, sourceUrl: AMAZON_CANONICAL_URL, originalUrl: AMAZON_PRODUCT_URL }),
    )
  })

  it('never builds the affiliate URL while creating a source', async () => {
    const buildAffiliateUrl = vi.spyOn(amazonUrlStrategy, 'buildAffiliateUrl')
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindShops([AMAZON_SHOP])
    mockInsertItemSource(SOURCE_WITH_SHOP_ROW)
    mockFindItemSourceByIdWithShop(SOURCE_WITH_SHOP_ROW, AMAZON_SHOP)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { sourceUrl: AMAZON_PRODUCT_URL },
    })

    expect(response.status).toBe(201)
    expect(buildAffiliateUrl).not.toHaveBeenCalled()
    buildAffiliateUrl.mockRestore()
  })

  it('does not return originalUrl nor affiliateUrl in the source response', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindShops([])
    const storedRow = {
      ...SOURCE_ROW,
      sourceUrl: CLEAN_URL,
      originalUrl: TRACKED_URL,
      affiliateUrl: 'https://shop.example/product?aff=1',
    }
    mockInsertItemSource(storedRow)
    mockFindItemSourceByIdWithShop(storedRow, null)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { sourceUrl: TRACKED_URL },
    })

    const body = await response.json() as { source: Record<string, unknown> }
    expect(response.status).toBe(201)
    expect(body.source).not.toHaveProperty('originalUrl')
    expect(body.source).not.toHaveProperty('affiliateUrl')
    expect(body.source.sourceUrl).toBe(CLEAN_URL)
  })

  it('normalizes the new URL and resets the affiliate URL on PATCH', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById({ ...SOURCE_ROW, sourceUrl: 'https://shop.example/old', affiliateUrl: 'https://shop.example/old?aff=1' })
    mockFindShops([])
    const set = mockUpdateRecordingSet({ ...SOURCE_ROW, sourceUrl: CLEAN_URL })
    mockFindItemSourceByIdWithShop({ ...SOURCE_ROW, sourceUrl: CLEAN_URL }, null)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { sourceUrl: TRACKED_URL },
    })

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith({ sourceUrl: CLEAN_URL, originalUrl: TRACKED_URL, affiliateUrl: null })
  })

  it('normalizes the submitted URL again with the new shop when only shopId changes', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById({ ...SOURCE_ROW, sourceUrl: AMAZON_PRODUCT_URL, originalUrl: AMAZON_PRODUCT_URL })
    mockFindShops([AMAZON_SHOP])
    const set = mockUpdateRecordingSet(SOURCE_WITH_SHOP_ROW)
    mockFindItemSourceByIdWithShop(SOURCE_WITH_SHOP_ROW, AMAZON_SHOP)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { shopId: AMAZON_SHOP.id },
    })

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith({
      shopId: AMAZON_SHOP.id,
      sourceUrl: AMAZON_CANONICAL_URL,
      originalUrl: AMAZON_PRODUCT_URL,
      affiliateUrl: null,
    })
  })

  it('leaves the URL columns untouched when the PATCH only changes the price', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById({ ...SOURCE_ROW, sourceUrl: CLEAN_URL, affiliateUrl: 'https://shop.example/product?aff=1' })
    const set = mockUpdateRecordingSet({ ...SOURCE_ROW, price: '12.00' })
    mockFindItemSourceByIdWithShop({ ...SOURCE_ROW, price: '12.00' }, null)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { price: '12.00' },
    })

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith({ price: '12.00' })
  })

  it('normalizes every source URL on POST /v1/admin/items', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindShops([AMAZON_SHOP])
    const values = vi.fn()
    for (const row of [ITEM_ROW, SOURCE_WITH_SHOP_ROW, SOURCE_ROW]) {
      values.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([row]) })
    }
    vi.mocked(db.transaction).mockImplementationOnce((callback) =>
      callback({ insert: vi.fn().mockReturnValue({ values }) } as never),
    )
    mockFindItemById(itemWith([SOURCE_WITH_SHOP_ROW, SOURCE_ROW]))

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', sources: [{ sourceUrl: AMAZON_PRODUCT_URL }, { sourceUrl: TRACKED_URL }] },
    })

    expect(response.status).toBe(201)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: AMAZON_SHOP.id, sourceUrl: AMAZON_CANONICAL_URL, originalUrl: AMAZON_PRODUCT_URL }),
    )
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: null, sourceUrl: CLEAN_URL, originalUrl: TRACKED_URL, affiliateUrl: null }),
    )
  })
})

describe('admin items — gtin and source URL uniqueness', () => {
  const EAN_13 = '4006381333931'
  const PADDED_GTIN = '04006381333931'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('stores the gtin left-padded to 14 digits on POST /v1/admin/items', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    const values = vi.fn()
    for (const row of [{ ...ITEM_ROW, gtin: PADDED_GTIN }, SOURCE_ROW]) {
      values.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([row]) })
    }
    vi.mocked(db.transaction).mockImplementationOnce((callback) =>
      callback({ insert: vi.fn().mockReturnValue({ values }) } as never),
    )
    mockFindItemById({ ...itemWith([SOURCE_ROW]), gtin: PADDED_GTIN })

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', gtin: EAN_13, sources: [{}] },
    })

    const body = adminItemsCreateResponseSchema.parse(await response.json())
    expect(response.status).toBe(201)
    expect(body.item.gtin).toBe(PADDED_GTIN)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ gtin: PADDED_GTIN }))
  })

  it('returns 422 when the gtin check digit is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', gtin: '4006381333932', sources: [{}] },
    })

    const body = await response.json() as { metadata: { issues: { path: string }[] } }
    expect(response.status).toBe(422)
    expect(body.metadata.issues[0]?.path).toBe('gtin')
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
  })

  it('returns 409 CONFLICT when the gtin is held by another item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.transaction).mockRejectedValueOnce(pgError(UNIQUE_VIOLATION, ITEMS_GTIN_UNIQUE_INDEX))

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', gtin: EAN_13, sources: [{}] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
  })

  it('returns 409 CONFLICT when a source URL is held by another item on POST /v1/admin/items', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.transaction).mockRejectedValueOnce(SOURCE_URL_HELD)

    const response = await apiRequest('/v1/admin/items', {
      method: 'POST',
      token,
      body: { name: 'Test Item', sources: [{ sourceUrl: 'https://shop.example/p/1' }] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
  })

  it('corrects the gtin on PATCH /v1/admin/items/:id', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem(ITEM_ROW)
    const set = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{ ...ITEM_ROW, gtin: PADDED_GTIN }]),
      }),
    })
    vi.mocked(db.update).mockReturnValueOnce({ set } as never)
    mockFindItemById({ ...itemWith([]), gtin: PADDED_GTIN })

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { gtin: EAN_13 },
    })

    const body = adminItemsUpdateResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.item.gtin).toBe(PADDED_GTIN)
    expect(set).toHaveBeenCalledWith({ gtin: PADDED_GTIN })
  })

  it('clears the gtin with null on PATCH /v1/admin/items/:id', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem({ ...ITEM_ROW, gtin: PADDED_GTIN })
    const set = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([ITEM_ROW]) }),
    })
    vi.mocked(db.update).mockReturnValueOnce({ set } as never)
    mockFindItemById(itemWith([]))

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { gtin: null },
    })

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith({ gtin: null })
  })

  it('returns 409 CONFLICT when the corrected gtin is held by another item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockExistingItem(ITEM_ROW)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(pgError(UNIQUE_VIOLATION, ITEMS_GTIN_UNIQUE_INDEX)),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { gtin: EAN_13 },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
  })

  it('returns 409 CONFLICT when a new source URL is held by another item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockInsertItemSourceRejected(SOURCE_URL_HELD)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources`, {
      method: 'POST',
      token,
      body: { sourceUrl: 'https://shop.example/p/1' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
  })

  it('returns 409 CONFLICT when an updated source URL is held by another item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindItemSourceById(SOURCE_ROW)
    mockUpdateItemSourceRejected(SOURCE_URL_HELD)

    const response = await apiRequest(`/v1/admin/items/${ITEM_ROW.id}/sources/${SOURCE_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { sourceUrl: 'https://shop.example/p/1' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
  })
})
