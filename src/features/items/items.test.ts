import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../../app.js'
import { db } from '../../db/client.js'
import { images } from '../../db/entities/images/images.schema.js'
import { env } from '../../config/env.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { apiMultipartRequest, apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'

const { mockProcessImage } = vi.hoisted(() => ({ mockProcessImage: vi.fn() }))

vi.mock('../uploads/image.pipeline.js', () => ({ processImage: mockProcessImage }))

const ITEM_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Test Item',
  description: 'A test item',
  imageUrl: null,
  imageId: null,
  createdByUserId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const OTHER_ITEM_ROW = {
  ...ITEM_ROW,
  id: '00000000-0000-0000-0000-000000000011',
  name: 'Other Item',
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

function itemWith(sources: SourceRow[]): typeof ITEM_ROW & {
  sources: SourceRow[]
  itemCategories: never[]
  itemTags: never[]
} {
  return { ...ITEM_ROW, sources, itemCategories: [], itemTags: [] }
}

function mockCountAllChain(total: number): void {
  const chain = {
    from: vi.fn().mockResolvedValueOnce([{ total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

describe('GET /v1/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with paginated items and embedded sources', async () => {
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([
      itemWith([SOURCE_ROW]),
      { ...OTHER_ITEM_ROW, sources: [], itemCategories: [], itemTags: [] },
    ] as never)
    mockCountAllChain(2)

    const response = await apiRequest('/v1/items')

    const body = await response.json() as {
      items: { id: string; name: string; sources: { itemId: string }[] }[]
      pagination: { total: number; page: number; limit: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
    expect(body.items[0]?.sources).toHaveLength(1)
    expect(body.items[0]?.sources[0]?.itemId).toBe(ITEM_ROW.id)
    expect(body.items[1]?.sources).toHaveLength(0)
  })

  it('embeds shop object on sources that reference a shop', async () => {
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([
      itemWith([SOURCE_WITH_SHOP_ROW]),
    ] as never)
    mockCountAllChain(1)

    const response = await apiRequest('/v1/items')

    const body = await response.json() as {
      items: { sources: { shopId: string | null; shop: { id: string; slug: string } | null }[] }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.sources[0]?.shopId).toBe(SHOP_ROW.id)
    expect(body.items[0]?.sources[0]?.shop?.slug).toBe(SHOP_ROW.slug)
    expect(body.items[0]?.sources[0]?.shop).not.toHaveProperty('isActive')
  })

  it('returns shop=null when the source has no shopId', async () => {
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([SOURCE_ROW])] as never)
    mockCountAllChain(1)

    const response = await apiRequest('/v1/items')

    const body = await response.json() as {
      items: { sources: { shopId: string | null; shop: unknown }[] }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.sources[0]?.shopId).toBeNull()
    expect(body.items[0]?.sources[0]?.shop).toBeNull()
  })

  it('issues a single query for items with embedded sources+shop (no batch reloads)', async () => {
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([SOURCE_WITH_SHOP_ROW])] as never)
    mockCountAllChain(1)

    await apiRequest('/v1/items')

    expect(vi.mocked(db.query.items.findMany)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(db.query.itemSources.findMany)).not.toHaveBeenCalled()
    expect(vi.mocked(db.query.shops.findMany)).not.toHaveBeenCalled()
  })

  it('honours pagination query params', async () => {
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountAllChain(1)

    const response = await apiRequest('/v1/items?page=2&limit=5')

    const body = await response.json() as { pagination: { page: number; limit: number } }
    expect(response.status).toBe(200)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.limit).toBe(5)
  })

  it('does not require authentication', async () => {
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([itemWith([])] as never)
    mockCountAllChain(1)

    const response = await apiRequest('/v1/items')
    expect(response.status).toBe(200)
  })
})

describe('GET /v1/items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with item and embedded sources', async () => {
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWith([SOURCE_ROW]))

    const response = await apiRequest(`/v1/items/${ITEM_ROW.id}`)

    const body = await response.json() as { item: { id: string; sources: { itemId: string; shop: unknown }[] } }
    expect(response.status).toBe(200)
    expect(body.item.id).toBe(ITEM_ROW.id)
    expect(body.item.sources).toHaveLength(1)
    expect(body.item.sources[0]?.itemId).toBe(ITEM_ROW.id)
    expect(body.item.sources[0]?.shop).toBeNull()
  })

  it('embeds shop on sources that reference one', async () => {
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWith([SOURCE_WITH_SHOP_ROW]))

    const response = await apiRequest(`/v1/items/${ITEM_ROW.id}`)

    const body = await response.json() as {
      item: { sources: { shop: { slug: string } | null }[] }
    }
    expect(response.status).toBe(200)
    expect(body.item.sources[0]?.shop?.slug).toBe(SHOP_ROW.slug)
  })

  it('returns 404 when item does not exist', async () => {
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/items/${ITEM_ROW.id}`)
    expect(response.status).toBe(404)
  })

  it('returns 422 when id is not a UUID', async () => {
    const response = await apiRequest('/v1/items/not-a-uuid')
    expect(response.status).toBe(422)
  })

  it('does not require authentication', async () => {
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWith([]))

    const response = await apiRequest(`/v1/items/${ITEM_ROW.id}`)
    expect(response.status).toBe(200)
  })
})

const OWNER_USER = {
  id: '00000000-0000-0000-0000-000000000040',
  email: 'owner@example.com',
  username: 'owner',
  passwordHash: 'hashed',
  authProvider: 'email' as const,
  role: 'user' as const,
  avatarUrl: null,
  avatarImageId: null,
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

const OTHER_USER_ID = '00000000-0000-0000-0000-000000000041'

const OWNED_ITEM_ROW = {
  ...ITEM_ROW,
  id: '00000000-0000-0000-0000-000000000050',
  createdByUserId: OWNER_USER.id,
}

const CATEGORY_ONE = {
  id: '00000000-0000-0000-0000-000000000060',
  parentId: null,
  slug: 'electronics',
  depth: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  translations: [
    { categoryId: '00000000-0000-0000-0000-000000000060', locale: 'en' as const, name: 'Electronics' },
    { categoryId: '00000000-0000-0000-0000-000000000060', locale: 'fr' as const, name: 'Électronique' },
  ],
}

const CATEGORY_TWO = {
  ...CATEGORY_ONE,
  id: '00000000-0000-0000-0000-000000000061',
  slug: 'mode',
  translations: [
    { categoryId: '00000000-0000-0000-0000-000000000061', locale: 'en' as const, name: 'Mode' },
    { categoryId: '00000000-0000-0000-0000-000000000061', locale: 'fr' as const, name: 'Mode' },
  ],
}

const OWNER_ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(OWNER_USER.id)

function mockOwnerAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(OWNER_USER as never)
}


const TAG_GAMING_ROW = {
  id: '00000000-0000-0000-0000-000000000070',
  name: 'gaming',
  slug: 'gaming',
  createdByUserId: OWNER_USER.id,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const TAG_READING_ROW = {
  ...TAG_GAMING_ROW,
  id: '00000000-0000-0000-0000-000000000071',
  name: 'reading',
  slug: 'reading',
}

function mockUpdateItemTagsTransaction(tagsReturned: (typeof TAG_GAMING_ROW)[]): void {
  vi.mocked(db.transaction).mockImplementationOnce((callback) => {
    const tagsFindMany = vi.fn().mockResolvedValueOnce(tagsReturned)
    const tx = {
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue([]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([OWNED_ITEM_ROW]),
          }),
        }),
      }),
      query: { tags: { findMany: tagsFindMany } },
    }
    return callback(tx as never)
  })
}

function itemWithTagLinks(tags: (typeof TAG_GAMING_ROW)[]): object {
  return {
    ...OWNED_ITEM_ROW,
    sources: [],
    itemCategories: [],
    itemTags: tags.map((tag) => ({ itemId: OWNED_ITEM_ROW.id, tagId: tag.id, assignedAt: new Date(), tag })),
  }
}

describe('POST /v1/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY)
  })

  function mockCreateItemTransaction(
    insertedItem: unknown,
    tagsReturned: (typeof TAG_GAMING_ROW)[] = [],
  ): void {
    vi.mocked(db.transaction).mockImplementationOnce((callback) => {
      const tagsFindMany = vi.fn().mockResolvedValueOnce(tagsReturned)
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValueOnce([insertedItem]),
            onConflictDoNothing: vi.fn().mockResolvedValue([]),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        query: { tags: { findMany: tagsFindMany } },
      }
      return callback(tx as never)
    })
  }

  it('returns 201 with the created item scoped to the authed user', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockCreateItemTransaction(OWNED_ITEM_ROW)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce({
      ...OWNED_ITEM_ROW,
      sources: [],
      itemCategories: [],
      itemTags: [],
    } as never)

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: { name: 'Nintendo Switch' },
    })

    const body = await response.json() as {
      item: { id: string; sources: unknown[]; tags: unknown[]; categories: unknown[] }
    }
    expect(response.status).toBe(201)
    expect(body.item.id).toBe(OWNED_ITEM_ROW.id)
    expect(body.item.sources).toEqual([])
    expect(body.item.tags).toEqual([])
    expect(body.item.categories).toEqual([])
  })

  it('returns 422 when name is missing', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: { description: 'no name' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/items', {
      method: 'POST',
      body: { name: 'Item' },
    })

    expect(response.status).toBe(401)
  })

  it('creates an item with tags and returns them hydrated', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockCreateItemTransaction(OWNED_ITEM_ROW, [TAG_GAMING_ROW, TAG_READING_ROW])
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(
      itemWithTagLinks([TAG_GAMING_ROW, TAG_READING_ROW]) as never,
    )

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: { name: 'Nintendo Switch', tags: ['Gaming', 'Reading'] },
    })

    const body = await response.json() as { item: { tags: { slug: string }[] } }
    expect(response.status).toBe(201)
    expect(body.item.tags.map((tag) => tag.slug)).toEqual(
      expect.arrayContaining(['gaming', 'reading']),
    )
  })

  it('creates an item with categories and returns them hydrated', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE, CATEGORY_TWO] as never)
    mockCreateItemTransaction(OWNED_ITEM_ROW)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce({
      ...OWNED_ITEM_ROW,
      sources: [],
      itemCategories: [
        { itemId: OWNED_ITEM_ROW.id, categoryId: CATEGORY_ONE.id, assignedAt: new Date(), category: CATEGORY_ONE },
        { itemId: OWNED_ITEM_ROW.id, categoryId: CATEGORY_TWO.id, assignedAt: new Date(), category: CATEGORY_TWO },
      ],
      itemTags: [],
    } as never)

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: { name: 'Nintendo Switch', categories: [CATEGORY_ONE.id, CATEGORY_TWO.id] },
    })

    const body = await response.json() as { item: { categories: { slug: string }[] } }
    expect(response.status).toBe(201)
    expect(body.item.categories.map((c) => c.slug)).toEqual(
      expect.arrayContaining(['electronics', 'mode']),
    )
  })

  it('creates an item with both tags and categories in a single request', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)
    mockCreateItemTransaction(OWNED_ITEM_ROW, [TAG_GAMING_ROW])
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce({
      ...OWNED_ITEM_ROW,
      sources: [],
      itemCategories: [
        { itemId: OWNED_ITEM_ROW.id, categoryId: CATEGORY_ONE.id, assignedAt: new Date(), category: CATEGORY_ONE },
      ],
      itemTags: [
        { itemId: OWNED_ITEM_ROW.id, tagId: TAG_GAMING_ROW.id, assignedAt: new Date(), tag: TAG_GAMING_ROW },
      ],
    } as never)

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: { name: 'Nintendo Switch', tags: ['Gaming'], categories: [CATEGORY_ONE.id] },
    })

    const body = await response.json() as {
      item: { tags: { slug: string }[]; categories: { slug: string }[] }
    }
    expect(response.status).toBe(201)
    expect(body.item.tags.map((t) => t.slug)).toEqual(['gaming'])
    expect(body.item.categories.map((c) => c.slug)).toEqual(['electronics'])
  })

  it('returns 422 TAG_INVALID_NAME when a tag name normalizes to an empty slug', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: { name: 'Nintendo Switch', tags: ['!!!'] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('TAG_INVALID_NAME')
  })

  it('returns 422 when tags exceeds max count (20)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: {
        name: 'Nintendo Switch',
        tags: Array.from({ length: 21 }, (_, i) => `tag-${String(i)}`),
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 404 CATEGORY_NOT_FOUND when a categoryId does not exist', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: {
        name: 'Nintendo Switch',
        categories: [CATEGORY_ONE.id, CATEGORY_TWO.id],
      },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
  })

  it('returns 422 when a category id is not a UUID', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: { name: 'Nintendo Switch', categories: ['not-a-uuid'] },
    })

    expect(response.status).toBe(422)
  })

  it('rolls back the item insert when category replacement fails inside the transaction', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((rows: unknown) => {
            if (
              Array.isArray(rows) &&
              rows.length > 0 &&
              (rows[0] as Record<string, unknown>).categoryId !== undefined
            ) {
              throw new Error('item_categories insert failed')
            }
            return { returning: vi.fn().mockResolvedValue([OWNED_ITEM_ROW]) }
          }),
        })),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        query: { tags: { findMany: vi.fn().mockResolvedValue([]) } },
      }
      return (await callback(tx as never))
    })

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: { name: 'Nintendo Switch', categories: [CATEGORY_ONE.id] },
    })

    expect(response.status).toBe(500)
    expect(vi.mocked(db.query.items.findFirst)).not.toHaveBeenCalled()
  })
})

describe('PATCH /v1/items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY)
  })

  it('replaces tags and returns item with hydrated tags when the user owns the item', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW)
      .mockResolvedValueOnce(itemWithTagLinks([TAG_GAMING_ROW, TAG_READING_ROW]) as never)
    mockUpdateItemTagsTransaction([TAG_GAMING_ROW, TAG_READING_ROW])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: ['Gaming', 'Reading'] },
    })

    const body = await response.json() as { item: { tags: { slug: string }[] } }
    expect(response.status).toBe(200)
    expect(body.item.tags.map((tag) => tag.slug)).toEqual(expect.arrayContaining(['gaming', 'reading']))
  })

  it('clears all tags when tags: [] is sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW)
      .mockResolvedValueOnce(itemWithTagLinks([]) as never)
    mockUpdateItemTagsTransaction([])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: [] },
    })

    const body = await response.json() as { item: { tags: unknown[] } }
    expect(response.status).toBe(200)
    expect(body.item.tags).toEqual([])
  })

  it('returns 403 FORBIDDEN when the user does not own the item', async () => {
    const token = await generateTestToken(OTHER_USER_ID)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(makeAccessTokenEntry(OTHER_USER_ID))
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...OWNER_USER, id: OTHER_USER_ID } as never)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW)

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: ['gaming'] },
    })

    expect(response.status).toBe(403)
  })

  it('returns 404 NOT_FOUND when the item does not exist', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: ['gaming'] },
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 TAG_INVALID_NAME when a tag name normalizes to an empty slug', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW)

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: ['!!!'] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('TAG_INVALID_NAME')
  })

  it('returns 422 when tags exceeds max count (20)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: Array.from({ length: 21 }, (_, i) => `tag-${String(i)}`) },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when body is empty (no fields to update)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: {},
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      body: { tags: ['gaming'] },
    })

    expect(response.status).toBe(401)
  })

  it('replaces categories when categories are provided', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW)
      .mockResolvedValueOnce({
        ...OWNED_ITEM_ROW,
        sources: [],
        itemCategories: [
          { itemId: OWNED_ITEM_ROW.id, categoryId: CATEGORY_ONE.id, assignedAt: new Date(), category: CATEGORY_ONE },
          { itemId: OWNED_ITEM_ROW.id, categoryId: CATEGORY_TWO.id, assignedAt: new Date(), category: CATEGORY_TWO },
        ],
        itemTags: [],
      } as never)
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE, CATEGORY_TWO] as never)

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { categories: [CATEGORY_ONE.id, CATEGORY_TWO.id] },
    })

    const body = await response.json() as { item: { categories: { slug: string }[] } }
    expect(response.status).toBe(200)
    expect(body.item.categories.map((c) => c.slug)).toEqual(expect.arrayContaining(['electronics', 'mode']))
  })

  it('returns 404 CATEGORY_NOT_FOUND when a categoryId does not exist', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW)
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { categories: [CATEGORY_ONE.id, CATEGORY_TWO.id] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
  })

  it('accepts tags and categories together in one PATCH', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW)
      .mockResolvedValueOnce({
        ...OWNED_ITEM_ROW,
        sources: [],
        itemCategories: [
          { itemId: OWNED_ITEM_ROW.id, categoryId: CATEGORY_ONE.id, assignedAt: new Date(), category: CATEGORY_ONE },
        ],
        itemTags: [
          { itemId: OWNED_ITEM_ROW.id, tagId: TAG_GAMING_ROW.id, assignedAt: new Date(), tag: TAG_GAMING_ROW },
        ],
      } as never)
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)
    mockUpdateItemTagsTransaction([TAG_GAMING_ROW])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { tags: ['Gaming'], categories: [CATEGORY_ONE.id] },
    })

    const body = await response.json() as { item: { tags: { slug: string }[]; categories: { slug: string }[] } }
    expect(response.status).toBe(200)
    expect(body.item.tags.map((t) => t.slug)).toEqual(['gaming'])
    expect(body.item.categories.map((c) => c.slug)).toEqual(['electronics'])
  })

  it('renames an item when only name is sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const renamed = { ...OWNED_ITEM_ROW, name: 'Renamed Item' }
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW)
      .mockResolvedValueOnce({ ...renamed, sources: [], itemCategories: [], itemTags: [] } as never)
    mockUpdateItemTagsTransaction([])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Renamed Item' },
    })

    const body = await response.json() as { item: { name: string; tags: unknown[]; categories: unknown[] } }
    expect(response.status).toBe(200)
    expect(body.item.name).toBe('Renamed Item')
    expect(body.item.tags).toEqual([])
    expect(body.item.categories).toEqual([])
  })

  it('updates description when only description is sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const updated = { ...OWNED_ITEM_ROW, description: 'A new description' }
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW)
      .mockResolvedValueOnce({ ...updated, sources: [], itemCategories: [], itemTags: [] } as never)
    mockUpdateItemTagsTransaction([])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { description: 'A new description' },
    })

    const body = await response.json() as { item: { description: string | null } }
    expect(response.status).toBe(200)
    expect(body.item.description).toBe('A new description')
  })

  it('clears description when description: null is sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW)
      .mockResolvedValueOnce({ ...OWNED_ITEM_ROW, description: null, sources: [], itemCategories: [], itemTags: [] } as never)
    mockUpdateItemTagsTransaction([])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { description: null },
    })

    const body = await response.json() as { item: { description: string | null } }
    expect(response.status).toBe(200)
    expect(body.item.description).toBeNull()
  })

  it('updates imageUrl when only imageUrl is sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const newUrl = 'https://example.com/img.jpg'
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW)
      .mockResolvedValueOnce({ ...OWNED_ITEM_ROW, imageUrl: newUrl, sources: [], itemCategories: [], itemTags: [] } as never)
    mockUpdateItemTagsTransaction([])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { imageUrl: newUrl },
    })

    const body = await response.json() as { item: { imageUrl: string | null } }
    expect(response.status).toBe(200)
    expect(body.item.imageUrl).toBe(newUrl)
  })

  it('updates name and tags together', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW)
      .mockResolvedValueOnce({
        ...OWNED_ITEM_ROW,
        name: 'Renamed',
        sources: [],
        itemCategories: [],
        itemTags: [{ itemId: OWNED_ITEM_ROW.id, tagId: TAG_GAMING_ROW.id, assignedAt: new Date(), tag: TAG_GAMING_ROW }],
      } as never)
    mockUpdateItemTagsTransaction([TAG_GAMING_ROW])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Renamed', tags: ['Gaming'] },
    })

    const body = await response.json() as { item: { name: string; tags: { slug: string }[] } }
    expect(response.status).toBe(200)
    expect(body.item.name).toBe('Renamed')
    expect(body.item.tags.map((t) => t.slug)).toEqual(['gaming'])
  })

  it('returns 422 when name is sent as empty string', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: '' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when an unknown field is sent (strict schema)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { unknownField: 'value' },
    })

    expect(response.status).toBe(422)
  })
})

describe('items mapper hydrates tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns tags array on GET /v1/items/:id', async () => {
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce({
      ...ITEM_ROW,
      sources: [],
      itemCategories: [],
      itemTags: [
        { itemId: ITEM_ROW.id, tagId: TAG_GAMING_ROW.id, assignedAt: new Date(), tag: TAG_GAMING_ROW },
      ],
    } as never)

    const response = await apiRequest(`/v1/items/${ITEM_ROW.id}`)

    const body = await response.json() as {
      item: { tags: { slug: string; name: string }[] }
    }
    expect(response.status).toBe(200)
    expect(body.item.tags).toHaveLength(1)
    expect(body.item.tags[0]?.slug).toBe('gaming')
  })

  it('returns tags array on GET /v1/items (list)', async () => {
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([
      {
        ...ITEM_ROW,
        sources: [],
        itemCategories: [],
        itemTags: [
          { itemId: ITEM_ROW.id, tagId: TAG_READING_ROW.id, assignedAt: new Date(), tag: TAG_READING_ROW },
        ],
      },
    ] as never)
    mockCountAllChain(1)

    const response = await apiRequest('/v1/items')

    const body = await response.json() as { items: { tags: { slug: string }[] }[] }
    expect(response.status).toBe(200)
    expect(body.items[0]?.tags[0]?.slug).toBe('reading')
  })
})

const NEW_IMAGE_ROW = {
  id: '00000000-0000-0000-0000-00000000b001',
  hash: 'b'.repeat(64),
  fileKey: 'bb/bb/' + 'b'.repeat(64),
  mime: 'image/png',
  sizeBytes: 4,
  width: 640,
  height: 480,
  uploadedBy: OWNER_USER.id,
  createdAt: new Date('2024-05-01'),
  updatedAt: new Date('2024-05-01'),
}

const PREVIOUS_IMAGE_ID = '00000000-0000-0000-0000-00000000b000'
const IMAGE_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const UPLOAD_BODY_LIMIT_OVERFLOW_BYTES = 64 * 1024 + 1

interface ItemImageBody {
  item: {
    id: string
    imageUrl: string | null
    imageId: string | null
    image: { id: string; urls: { sm: string; md: string; lg: string } } | null
  }
}

interface ErrorBody {
  code: string
  metadata: { issues?: { path: string; message: string; code: string }[] }
}

interface ItemWriteSpies {
  values: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

function mockItemWriteTransaction(writtenRow: unknown): ItemWriteSpies {
  const values = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(writtenRow === undefined ? [] : [writtenRow]),
    onConflictDoNothing: vi.fn().mockResolvedValue([]),
  })
  const set = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(writtenRow === undefined ? [] : [writtenRow]),
    }),
  })
  vi.mocked(db.transaction).mockImplementationOnce((callback) => {
    const tx = {
      insert: vi.fn().mockReturnValue({ values }),
      update: vi.fn().mockReturnValue({ set }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      query: { tags: { findMany: vi.fn().mockResolvedValue([TAG_GAMING_ROW]) } },
    }
    return callback(tx as never)
  })
  return { values, set }
}

function hydrated(row: object, image: typeof NEW_IMAGE_ROW | null): object {
  return { ...row, image, sources: [], itemCategories: [], itemTags: [] }
}

async function sendMultipartForm(path: string, method: string, token: string, form: FormData): Promise<Response> {
  return app.request(path, { method, headers: { Authorization: `Bearer ${token}` }, body: form })
}

function imageBlob(buffer: Buffer = IMAGE_BUFFER): Blob {
  return new Blob([new Uint8Array(buffer)], { type: 'image/png' })
}

describe('POST /v1/items — multipart image upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY)
    mockProcessImage.mockResolvedValue({ image: NEW_IMAGE_ROW })
  })

  it('returns 201 with the uploaded image linked to the item and imageUrl null', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const createdRow = { ...OWNED_ITEM_ROW, imageId: NEW_IMAGE_ROW.id }
    const spies = mockItemWriteTransaction(createdRow)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(hydrated(createdRow, NEW_IMAGE_ROW) as never)

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch' },
      image: { buffer: IMAGE_BUFFER },
    })

    const body = await response.json() as ItemImageBody
    expect(response.status).toBe(201)
    expect(body.item.imageId).toBe(NEW_IMAGE_ROW.id)
    expect(body.item.imageUrl).toBeNull()
    expect(body.item.image?.urls.sm).toContain('-300.webp')
    expect(body.item.image?.urls.md).toContain('-800.webp')
    expect(body.item.image?.urls.lg).toContain('-1600.webp')
    expect(mockProcessImage).toHaveBeenCalledWith(expect.any(Buffer), OWNER_USER.id)
    expect(spies.values).toHaveBeenCalledWith(expect.objectContaining({
      imageId: NEW_IMAGE_ROW.id,
      imageUrl: null,
      createdByUserId: OWNER_USER.id,
    }))
  })

  it('persists JSON-encoded tags and categories sent as multipart string fields', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)
    const spies = mockItemWriteTransaction(OWNED_ITEM_ROW)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(hydrated(OWNED_ITEM_ROW, NEW_IMAGE_ROW) as never)

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: {
        name: 'Nintendo Switch',
        description: 'Console',
        tags: '["Gaming","a,b"]',
        categories: JSON.stringify([CATEGORY_ONE.id]),
      },
      image: { buffer: IMAGE_BUFFER },
    })

    expect(response.status).toBe(201)
    expect(spies.values).toHaveBeenCalledWith(expect.objectContaining({ description: 'Console' }))
    expect(spies.values).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ slug: 'gaming' }),
    ]))
    expect(spies.values).toHaveBeenCalledWith([{ itemId: OWNED_ITEM_ROW.id, categoryId: CATEGORY_ONE.id }])
  })

  it('returns 201 with imageId and image null when no image part is sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const spies = mockItemWriteTransaction(OWNED_ITEM_ROW)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(hydrated(OWNED_ITEM_ROW, null) as never)

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch', imageUrl: '' },
    })

    const body = await response.json() as ItemImageBody
    expect(response.status).toBe(201)
    expect(body.item.imageId).toBeNull()
    expect(body.item.image).toBeNull()
    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(spies.values).toHaveBeenCalledWith(expect.objectContaining({ imageId: null, imageUrl: null }))
  })

  it('keeps the JSON body contract unchanged (imageUrl stored, no image processed)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const createdRow = { ...OWNED_ITEM_ROW, imageUrl: 'https://cdn.example.com/a.png' }
    const spies = mockItemWriteTransaction(createdRow)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(hydrated(createdRow, null) as never)

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: { name: 'Nintendo Switch', imageUrl: 'https://cdn.example.com/a.png' },
    })

    const body = await response.json() as ItemImageBody
    expect(response.status).toBe(201)
    expect(body.item.imageUrl).toBe('https://cdn.example.com/a.png')
    expect(body.item.image).toBeNull()
    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(spies.values).toHaveBeenCalledWith(expect.objectContaining({ imageId: null }))
  })

  it('returns 422 ITEM_IMAGE_SOURCE_CONFLICT when image and imageUrl are both sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch', imageUrl: 'https://cdn.example.com/a.png' },
      image: { buffer: IMAGE_BUFFER },
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(422)
    expect(body.code).toBe(ErrorCode.ITEM_IMAGE_SOURCE_CONFLICT)
    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
  })

  it('returns 422 with a {path, message, code} issue when tags is not valid JSON', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch', tags: 'gaming,reading' },
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(422)
    expect(body.code).toBe(ErrorCode.UNPROCESSABLE_ENTITY)
    expect(body.metadata.issues).toEqual([
      { path: 'tags', message: 'Expected a JSON-encoded value', code: 'custom' },
    ])
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('returns 422 when tags decodes to a non-array JSON value', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch', tags: '"gaming"' },
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(422)
    expect(body.metadata.issues?.[0]?.path).toBe('tags')
  })

  it('returns 422 instead of dropping array keys (tags[]) and repeated keys', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const form = new FormData()
    form.append('name', 'Nintendo Switch')
    form.append('tags[]', 'gaming')
    form.append('description', 'one')
    form.append('description', 'two')

    const response = await sendMultipartForm('/v1/items', 'POST', token, form)

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(422)
    expect(body.metadata.issues?.map((issue) => issue.path)).toEqual(['tags[]', 'description'])
  })

  it('returns 422 when a file is sent under a non-image key', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const form = new FormData()
    form.append('name', 'Nintendo Switch')
    form.append('avatar', imageBlob(), 'avatar.png')

    const response = await sendMultipartForm('/v1/items', 'POST', token, form)

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(422)
    expect(body.metadata.issues?.[0]?.path).toBe('avatar')
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('returns 422 when an unknown multipart field is sent (strict schema)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch', imageId: NEW_IMAGE_ROW.id },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 with the validationErrorHandler issue shape on an invalid JSON body', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest('/v1/items', { method: 'POST', token, body: { description: 'x' } })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(422)
    expect(body.metadata.issues?.[0]).toEqual({ path: 'name', message: expect.any(String) as string, code: 'invalid_type' })
  })

  it('returns 400 INVALID_IMAGE_TYPE when the sniffed MIME is not allowed', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockProcessImage.mockResolvedValueOnce({ errorCode: ErrorCode.INVALID_IMAGE_TYPE })

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch' },
      image: { buffer: Buffer.from('plain text'), filename: 'fake.jpg', contentType: 'image/jpeg' },
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(400)
    expect(body.code).toBe(ErrorCode.INVALID_IMAGE_TYPE)
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_IMAGE when the image part is empty', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch' },
      image: { buffer: Buffer.alloc(0) },
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(400)
    expect(body.code).toBe(ErrorCode.INVALID_IMAGE)
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('returns 413 PAYLOAD_TOO_LARGE when the pipeline rejects an oversized image', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockProcessImage.mockResolvedValueOnce({ errorCode: ErrorCode.PAYLOAD_TOO_LARGE })

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch' },
      image: { buffer: IMAGE_BUFFER },
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(413)
    expect(body.code).toBe(ErrorCode.PAYLOAD_TOO_LARGE)
  })

  it('returns 413 PAYLOAD_TOO_LARGE from the body limit before parsing the multipart body', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const oversized = Buffer.alloc(env.UPLOADS_MAX_SIZE_BYTES + UPLOAD_BODY_LIMIT_OVERFLOW_BYTES)

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch' },
      image: { buffer: oversized },
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(413)
    expect(body.code).toBe(ErrorCode.PAYLOAD_TOO_LARGE)
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('returns 400 BAD_REQUEST on a malformed multipart body', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await app.request('/v1/items', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data; boundary=missing',
      },
      body: 'not a multipart payload',
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(400)
    expect(body.code).toBe(ErrorCode.BAD_REQUEST)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      fields: { name: 'Nintendo Switch' },
      image: { buffer: IMAGE_BUFFER },
    })

    expect(response.status).toBe(401)
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('deletes the new images row when the item transaction throws', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.transaction).mockRejectedValueOnce(new Error('insert failed'))

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch' },
      image: { buffer: IMAGE_BUFFER },
    })

    expect(response.status).toBe(500)
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
    expect(vi.mocked(db.query.items.findFirst)).not.toHaveBeenCalled()
  })

  it('deletes the new images row when the item insert returns no row', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockItemWriteTransaction(undefined)

    const response = await apiMultipartRequest('/v1/items', {
      method: 'POST',
      token,
      fields: { name: 'Nintendo Switch' },
      image: { buffer: IMAGE_BUFFER },
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(500)
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR)
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
  })
})

describe('PATCH /v1/items/:id — image replace / clear', () => {
  const ITEM_WITH_IMAGE_ROW = { ...OWNED_ITEM_ROW, imageId: PREVIOUS_IMAGE_ID }
  const PATH = `/v1/items/${OWNED_ITEM_ROW.id}`

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY)
    mockProcessImage.mockResolvedValue({ image: NEW_IMAGE_ROW })
  })

  it('sets the uploaded image on an item without image', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const updatedRow = { ...OWNED_ITEM_ROW, imageId: NEW_IMAGE_ROW.id }
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW)
      .mockResolvedValueOnce(hydrated(updatedRow, NEW_IMAGE_ROW) as never)
    const spies = mockItemWriteTransaction(updatedRow)

    const response = await apiMultipartRequest(PATH, { method: 'PATCH', token, image: { buffer: IMAGE_BUFFER } })

    const body = await response.json() as ItemImageBody
    expect(response.status).toBe(200)
    expect(body.item.image?.urls.md).toContain('-800.webp')
    expect(spies.set).toHaveBeenCalledWith({ imageId: NEW_IMAGE_ROW.id, imageUrl: null })
    expect(vi.mocked(db.delete)).not.toHaveBeenCalled()
  })

  it('replaces an uploaded image and deletes the previous images row', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const updatedRow = { ...OWNED_ITEM_ROW, imageId: NEW_IMAGE_ROW.id }
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(ITEM_WITH_IMAGE_ROW)
      .mockResolvedValueOnce(hydrated(updatedRow, NEW_IMAGE_ROW) as never)
    mockItemWriteTransaction(updatedRow)

    const response = await apiMultipartRequest(PATH, { method: 'PATCH', token, image: { buffer: IMAGE_BUFFER } })

    const body = await response.json() as ItemImageBody
    expect(response.status).toBe(200)
    expect(body.item.imageId).toBe(NEW_IMAGE_ROW.id)
    expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
  })

  it.each([
    ['multipart', true],
    ['JSON', false],
  ])('clears the uploaded image with clearImage=true (%s) and deletes the previous row', async (_label, isMultipart) => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const updatedRow = { ...OWNED_ITEM_ROW, imageId: null }
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(ITEM_WITH_IMAGE_ROW)
      .mockResolvedValueOnce(hydrated(updatedRow, null) as never)
    const spies = mockItemWriteTransaction(updatedRow)

    const response = isMultipart
      ? await apiMultipartRequest(PATH, { method: 'PATCH', token, fields: { clearImage: 'true' } })
      : await apiRequest(PATH, { method: 'PATCH', token, body: { clearImage: true } })

    const body = await response.json() as ItemImageBody
    expect(response.status).toBe(200)
    expect(body.item.imageId).toBeNull()
    expect(body.item.image).toBeNull()
    expect(spies.set).toHaveBeenCalledWith({ imageId: null })
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('nulls a legacy imageUrl when an image is uploaded', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const legacyRow = { ...OWNED_ITEM_ROW, imageUrl: 'https://cdn.example.com/legacy.png' }
    const updatedRow = { ...OWNED_ITEM_ROW, imageId: NEW_IMAGE_ROW.id, imageUrl: null }
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(legacyRow)
      .mockResolvedValueOnce(hydrated(updatedRow, NEW_IMAGE_ROW) as never)
    const spies = mockItemWriteTransaction(updatedRow)

    const response = await apiMultipartRequest(PATH, { method: 'PATCH', token, image: { buffer: IMAGE_BUFFER } })

    const body = await response.json() as ItemImageBody
    expect(response.status).toBe(200)
    expect(body.item.imageUrl).toBeNull()
    expect(body.item.image?.id).toBe(NEW_IMAGE_ROW.id)
    expect(spies.set).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: null }))
  })

  it('switches to an external imageUrl, clearing imageId and deleting the previous row', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const imageUrl = 'https://cdn.example.com/new.png'
    const updatedRow = { ...OWNED_ITEM_ROW, imageId: null, imageUrl }
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(ITEM_WITH_IMAGE_ROW)
      .mockResolvedValueOnce(hydrated(updatedRow, null) as never)
    const spies = mockItemWriteTransaction(updatedRow)

    const response = await apiRequest(PATH, { method: 'PATCH', token, body: { imageUrl } })

    const body = await response.json() as ItemImageBody
    expect(response.status).toBe(200)
    expect(body.item.imageId).toBeNull()
    expect(body.item.imageUrl).toBe(imageUrl)
    expect(spies.set).toHaveBeenCalledWith({ imageUrl, imageId: null })
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
  })

  it('keeps the uploaded image when imageUrl: null is sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(ITEM_WITH_IMAGE_ROW)
      .mockResolvedValueOnce(hydrated(ITEM_WITH_IMAGE_ROW, null) as never)
    const spies = mockItemWriteTransaction(ITEM_WITH_IMAGE_ROW)

    const response = await apiRequest(PATH, { method: 'PATCH', token, body: { imageUrl: null } })

    expect(response.status).toBe(200)
    expect(spies.set).toHaveBeenCalledWith({ imageUrl: null })
    expect(vi.mocked(db.delete)).not.toHaveBeenCalled()
  })

  it('returns 422 NO_FIELDS_TO_UPDATE when only clearImage=false is sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiMultipartRequest(PATH, { method: 'PATCH', token, fields: { clearImage: 'false' } })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(422)
    expect(body.code).toBe(ErrorCode.NO_FIELDS_TO_UPDATE)
  })

  it('returns 422 IMAGE_AND_CLEAR_CONFLICT when image and clearImage=true are both sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiMultipartRequest(PATH, {
      method: 'PATCH',
      token,
      fields: { clearImage: 'true' },
      image: { buffer: IMAGE_BUFFER },
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(422)
    expect(body.code).toBe(ErrorCode.IMAGE_AND_CLEAR_CONFLICT)
    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
  })

  it('returns 422 ITEM_IMAGE_SOURCE_CONFLICT when image and imageUrl are both sent', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiMultipartRequest(PATH, {
      method: 'PATCH',
      token,
      fields: { imageUrl: 'https://cdn.example.com/a.png' },
      image: { buffer: IMAGE_BUFFER },
    })

    const body = await response.json() as ErrorBody
    expect(response.status).toBe(422)
    expect(body.code).toBe(ErrorCode.ITEM_IMAGE_SOURCE_CONFLICT)
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-owner without processing the image', async () => {
    const token = await generateTestToken(OTHER_USER_ID)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(makeAccessTokenEntry(OTHER_USER_ID))
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...OWNER_USER, id: OTHER_USER_ID } as never)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW)

    const response = await apiMultipartRequest(PATH, { method: 'PATCH', token, image: { buffer: IMAGE_BUFFER } })

    expect(response.status).toBe(403)
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('returns 403 when the item creator was deleted (createdByUserId NULL)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce({ ...OWNED_ITEM_ROW, createdByUserId: null })

    const response = await apiMultipartRequest(PATH, { method: 'PATCH', token, image: { buffer: IMAGE_BUFFER } })

    expect(response.status).toBe(403)
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown item without processing the image', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiMultipartRequest(PATH, { method: 'PATCH', token, image: { buffer: IMAGE_BUFFER } })

    expect(response.status).toBe(404)
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiMultipartRequest(PATH, { method: 'PATCH', image: { buffer: IMAGE_BUFFER } })

    expect(response.status).toBe(401)
  })

  it('rolls back the new image and keeps the previous one when the transaction throws', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(ITEM_WITH_IMAGE_ROW)
    vi.mocked(db.transaction).mockRejectedValueOnce(new Error('update failed'))

    const response = await apiMultipartRequest(PATH, { method: 'PATCH', token, image: { buffer: IMAGE_BUFFER } })

    expect(response.status).toBe(500)
    expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
  })

  it('rolls back the new image when the item vanished before the update', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(ITEM_WITH_IMAGE_ROW)
    mockItemWriteTransaction(undefined)

    const response = await apiMultipartRequest(PATH, { method: 'PATCH', token, image: { buffer: IMAGE_BUFFER } })

    expect(response.status).toBe(404)
    expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1)
  })

  it('returns 413 PAYLOAD_TOO_LARGE from the body limit', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    const oversized = Buffer.alloc(env.UPLOADS_MAX_SIZE_BYTES + UPLOAD_BODY_LIMIT_OVERFLOW_BYTES)

    const response = await apiMultipartRequest(PATH, { method: 'PATCH', token, image: { buffer: oversized } })

    expect(response.status).toBe(413)
    expect(vi.mocked(db.query.items.findFirst)).not.toHaveBeenCalled()
  })
})
