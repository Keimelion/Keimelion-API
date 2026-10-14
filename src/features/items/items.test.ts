import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'

const ITEM_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Test Item',
  description: 'A test item',
  imageUrl: null,
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
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWith([SOURCE_ROW]) as never)

    const response = await apiRequest(`/v1/items/${ITEM_ROW.id}`)

    const body = await response.json() as { item: { id: string; sources: { itemId: string; shop: unknown }[] } }
    expect(response.status).toBe(200)
    expect(body.item.id).toBe(ITEM_ROW.id)
    expect(body.item.sources).toHaveLength(1)
    expect(body.item.sources[0]?.itemId).toBe(ITEM_ROW.id)
    expect(body.item.sources[0]?.shop).toBeNull()
  })

  it('embeds shop on sources that reference one', async () => {
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWith([SOURCE_WITH_SHOP_ROW]) as never)

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
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWith([]) as never)

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
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY as never)
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
      query: { tags: { findMany: tagsFindMany } },
    }
    return callback(tx as never) as never
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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY as never)
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
      return callback(tx as never) as never
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
      return (await callback(tx as never)) as never
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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY as never)
  })

  it('replaces tags and returns item with hydrated tags when the user owns the item', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst)
      .mockResolvedValueOnce(OWNED_ITEM_ROW as never)
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
      .mockResolvedValueOnce(OWNED_ITEM_ROW as never)
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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(makeAccessTokenEntry(OTHER_USER_ID) as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...OWNER_USER, id: OTHER_USER_ID } as never)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW as never)

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
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW as never)

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
      .mockResolvedValueOnce(OWNED_ITEM_ROW as never)
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
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW as never)
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
      .mockResolvedValueOnce(OWNED_ITEM_ROW as never)
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
