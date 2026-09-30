import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'

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

const SOURCE_ROW = {
  id: '00000000-0000-0000-0000-000000000030',
  itemId: ITEM_ROW.id,
  shopId: null,
  sourceUrl: null,
  price: null,
  currency: 'EUR',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const SOURCE_WITH_SHOP_ROW = {
  ...SOURCE_ROW,
  id: '00000000-0000-0000-0000-000000000031',
  shopId: SHOP_ROW.id,
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
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW, OTHER_ITEM_ROW] as never)
    mockCountAllChain(2)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([SOURCE_ROW] as never)

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
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
    mockCountAllChain(1)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([SOURCE_WITH_SHOP_ROW] as never)
    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([SHOP_ROW] as never)

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
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
    mockCountAllChain(1)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([SOURCE_ROW] as never)

    const response = await apiRequest('/v1/items')

    const body = await response.json() as {
      items: { sources: { shopId: string | null; shop: unknown }[] }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.sources[0]?.shopId).toBeNull()
    expect(body.items[0]?.sources[0]?.shop).toBeNull()
  })

  it('honours pagination query params', async () => {
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
    mockCountAllChain(1)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([] as never)

    const response = await apiRequest('/v1/items?page=2&limit=5')

    const body = await response.json() as { pagination: { page: number; limit: number } }
    expect(response.status).toBe(200)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.limit).toBe(5)
  })

  it('does not require authentication', async () => {
    vi.mocked(db.query.items.findMany).mockResolvedValueOnce([ITEM_ROW] as never)
    mockCountAllChain(1)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([] as never)

    const response = await apiRequest('/v1/items')
    expect(response.status).toBe(200)
  })
})

describe('GET /v1/items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with item and embedded sources', async () => {
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(ITEM_ROW as never)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([SOURCE_ROW] as never)

    const response = await apiRequest(`/v1/items/${ITEM_ROW.id}`)

    const body = await response.json() as { item: { id: string; sources: { itemId: string; shop: unknown }[] } }
    expect(response.status).toBe(200)
    expect(body.item.id).toBe(ITEM_ROW.id)
    expect(body.item.sources).toHaveLength(1)
    expect(body.item.sources[0]?.itemId).toBe(ITEM_ROW.id)
    expect(body.item.sources[0]?.shop).toBeNull()
  })

  it('embeds shop on sources that reference one', async () => {
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(ITEM_ROW as never)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([SOURCE_WITH_SHOP_ROW] as never)
    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce([SHOP_ROW] as never)

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
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(ITEM_ROW as never)
    vi.mocked(db.query.itemSources.findMany).mockResolvedValueOnce([] as never)

    const response = await apiRequest(`/v1/items/${ITEM_ROW.id}`)
    expect(response.status).toBe(200)
  })
})
