import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken } from '../../shared/test/auth.js'
import {
  itemsGetResponseSchema,
  itemsListResponseSchema,
} from '@keimelion/sdk/schemas'

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
    itemsListResponseSchema.parse(body)
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
    itemsGetResponseSchema.parse(body)
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

  it('does not return the original nor the affiliate URL of a source', async () => {
    const source = {
      ...SOURCE_WITH_SHOP_ROW,
      sourceUrl: 'https://www.amazon.fr/dp/B08N5WRWNW',
      originalUrl: 'https://www.amazon.fr/dp/B08N5WRWNW?tag=someone-21',
      affiliateUrl: 'https://www.amazon.fr/dp/B08N5WRWNW?tag=keimelion-21',
    }
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(itemWith([source]))

    const response = await apiRequest(`/v1/items/${ITEM_ROW.id}`)

    const body = await response.json() as { item: { sources: Record<string, unknown>[] } }
    expect(response.status).toBe(200)
    expect(body.item.sources[0]?.sourceUrl).toBe(source.sourceUrl)
    expect(body.item.sources[0]).not.toHaveProperty('originalUrl')
    expect(body.item.sources[0]).not.toHaveProperty('affiliateUrl')
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

const OWNED_ITEM_ROW = {
  ...ITEM_ROW,
  id: '00000000-0000-0000-0000-000000000050',
  createdByUserId: OWNER_USER.id,
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

describe('POST /v1/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 because products are added through POST /v1/lists/:id/items', async () => {
    const token = await generateTestToken(OWNER_USER.id)

    const response = await apiRequest('/v1/items', {
      method: 'POST',
      token,
      body: { name: 'Nintendo Switch' },
    })

    expect(response.status).toBe(404)
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
  })
})

describe('PATCH /v1/items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 because items are admin-only and the user update route is removed', async () => {
    const token = await generateTestToken(OWNER_USER.id)

    const response = await apiRequest(`/v1/items/${OWNED_ITEM_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Renamed' },
    })

    expect(response.status).toBe(404)
    expect(vi.mocked(db.query.items.findFirst)).not.toHaveBeenCalled()
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
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


