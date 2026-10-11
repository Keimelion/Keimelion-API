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
  name: 'Électronique',
  slug: 'electronique',
  depth: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const CATEGORY_TWO = {
  ...CATEGORY_ONE,
  id: '00000000-0000-0000-0000-000000000061',
  name: 'Mode',
  slug: 'mode',
}

const OWNER_ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(OWNER_USER.id)

function mockOwnerAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY as never)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(OWNER_USER as never)
}

describe('POST /v1/items/:id/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with assigned categories when the user owns the item', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW as never)
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce(
      [CATEGORY_ONE, CATEGORY_TWO] as never,
    )
    vi.mocked(db.transaction).mockImplementationOnce((callback) => {
      const txFindMany = vi.fn().mockResolvedValueOnce([
        { itemId: OWNED_ITEM_ROW.id, categoryId: CATEGORY_ONE.id, assignedAt: new Date(), category: CATEGORY_ONE },
        { itemId: OWNED_ITEM_ROW.id, categoryId: CATEGORY_TWO.id, assignedAt: new Date(), category: CATEGORY_TWO },
      ])
      const tx = {
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
        query: { itemCategories: { findMany: txFindMany } },
      }
      return callback(tx as never) as never
    })

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/categories`, {
      method: 'POST',
      token,
      body: { categoryIds: [CATEGORY_ONE.id, CATEGORY_TWO.id] },
    })

    const body = await response.json() as { categories: { id: string; slug: string }[] }
    expect(response.status).toBe(200)
    expect(body.categories).toHaveLength(2)
    expect(body.categories.map((category) => category.slug)).toEqual(
      expect.arrayContaining(['electronique', 'mode']),
    )
  })

  it('returns 200 with empty assignments when categoryIds is empty (clears existing)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW as never)
    vi.mocked(db.transaction).mockImplementationOnce((callback) => {
      const tx = {
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
        query: { itemCategories: { findMany: vi.fn().mockResolvedValueOnce([]) } },
      }
      return callback(tx as never) as never
    })

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/categories`, {
      method: 'POST',
      token,
      body: { categoryIds: [] },
    })

    const body = await response.json() as { categories: unknown[] }
    expect(response.status).toBe(200)
    expect(body.categories).toHaveLength(0)
  })

  it('returns 404 NOT_FOUND when the item does not exist', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/categories`, {
      method: 'POST',
      token,
      body: { categoryIds: [CATEGORY_ONE.id] },
    })

    expect(response.status).toBe(404)
  })

  it('returns 403 FORBIDDEN when the user does not own the item', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(
      { ...OWNED_ITEM_ROW, createdByUserId: OTHER_USER_ID } as never,
    )

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/categories`, {
      method: 'POST',
      token,
      body: { categoryIds: [CATEGORY_ONE.id] },
    })

    expect(response.status).toBe(403)
  })

  it('returns 404 CATEGORY_NOT_FOUND when one of the categoryIds does not exist', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW as never)
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([CATEGORY_ONE] as never)

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/categories`, {
      method: 'POST',
      token,
      body: { categoryIds: [CATEGORY_ONE.id, CATEGORY_TWO.id] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
  })

  it('returns 422 when categoryIds contains a non-UUID value', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/categories`, {
      method: 'POST',
      token,
      body: { categoryIds: ['not-a-uuid'] },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest('/v1/items/not-a-uuid/categories', {
      method: 'POST',
      token,
      body: { categoryIds: [CATEGORY_ONE.id] },
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/categories`, {
      method: 'POST',
      body: { categoryIds: [CATEGORY_ONE.id] },
    })

    expect(response.status).toBe(401)
  })
})

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

function mockAssignTagsTransaction(assignments: { tag: typeof TAG_GAMING_ROW }[]): void {
  vi.mocked(db.transaction).mockImplementationOnce((callback) => {
    const txFindMany = vi.fn().mockResolvedValueOnce(
      assignments.map((assignment) => ({
        itemId: OWNED_ITEM_ROW.id,
        tagId: assignment.tag.id,
        assignedAt: new Date(),
        tag: assignment.tag,
      })),
    )
    const tx = {
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
      query: { itemTags: { findMany: txFindMany } },
    }
    return callback(tx as never) as never
  })
}

function mockInsertTagsIgnoreConflict(): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      onConflictDoNothing: vi.fn().mockResolvedValueOnce([]),
    }),
  } as never)
}

describe('POST /v1/items/:id/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 and auto-creates missing tags by normalized slug', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW as never)
    mockInsertTagsIgnoreConflict()
    vi.mocked(db.query.tags.findMany).mockResolvedValueOnce(
      [TAG_GAMING_ROW, TAG_READING_ROW] as never,
    )
    mockAssignTagsTransaction([{ tag: TAG_GAMING_ROW }, { tag: TAG_READING_ROW }])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/tags`, {
      method: 'POST',
      token,
      body: { names: ['Gaming', 'Reading'] },
    })

    const body = await response.json() as { tags: { slug: string; name: string }[] }
    expect(response.status).toBe(200)
    expect(body.tags).toHaveLength(2)
    expect(body.tags.map((tag) => tag.slug)).toEqual(
      expect.arrayContaining(['gaming', 'reading']),
    )
  })

  it('deduplicates names that normalize to the same slug', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW as never)
    mockInsertTagsIgnoreConflict()
    vi.mocked(db.query.tags.findMany).mockResolvedValueOnce([TAG_GAMING_ROW] as never)
    mockAssignTagsTransaction([{ tag: TAG_GAMING_ROW }])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/tags`, {
      method: 'POST',
      token,
      body: { names: ['Gaming', 'gaming', 'GAMING'] },
    })

    const body = await response.json() as { tags: { slug: string }[] }
    expect(response.status).toBe(200)
    expect(body.tags).toHaveLength(1)
    expect(body.tags[0]?.slug).toBe('gaming')
  })

  it('returns 200 with empty tags when names is empty (clears existing)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW as never)
    mockAssignTagsTransaction([])

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/tags`, {
      method: 'POST',
      token,
      body: { names: [] },
    })

    const body = await response.json() as { tags: unknown[] }
    expect(response.status).toBe(200)
    expect(body.tags).toHaveLength(0)
  })

  it('returns 404 NOT_FOUND when the item does not exist', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/tags`, {
      method: 'POST',
      token,
      body: { names: ['gaming'] },
    })

    expect(response.status).toBe(404)
  })

  it('returns 403 FORBIDDEN when the user does not own the item', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(
      { ...OWNED_ITEM_ROW, createdByUserId: OTHER_USER_ID } as never,
    )

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/tags`, {
      method: 'POST',
      token,
      body: { names: ['gaming'] },
    })

    expect(response.status).toBe(403)
  })

  it('returns 422 TAG_INVALID_NAME when a name normalizes to an empty slug', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(OWNED_ITEM_ROW as never)

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/tags`, {
      method: 'POST',
      token,
      body: { names: ['!!!'] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('TAG_INVALID_NAME')
  })

  it('returns 422 when names exceeds max count (20)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const tooMany = Array.from({ length: 21 }, (_, index) => `tag-${String(index)}`)
    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/tags`, {
      method: 'POST',
      token,
      body: { names: tooMany },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest('/v1/items/not-a-uuid/tags', {
      method: 'POST',
      token,
      body: { names: ['gaming'] },
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}/tags`, {
      method: 'POST',
      body: { names: ['gaming'] },
    })

    expect(response.status).toBe(401)
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
