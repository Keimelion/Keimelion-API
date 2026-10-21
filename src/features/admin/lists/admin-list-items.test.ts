import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../../db/client.js'
import { apiRequest } from '../../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../../shared/test/auth.js'

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

const LIST_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  occasionTypeId: null,
  title: 'Birthday wishlist',
  slug: 'birthday-wishlist',
  description: null,
  listStatus: 'active' as const,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const DELETED_LIST_ROW = {
  ...LIST_ROW,
  id: '00000000-0000-0000-0000-000000000011',
  deletedAt: new Date('2024-06-01'),
}

const ITEM_ROW = {
  id: '00000000-0000-0000-0000-000000000020',
  name: 'My Item',
  description: null,
  imageUrl: null,
  createdByUserId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const SHOP_ROW = {
  id: '00000000-0000-0000-0000-000000000030',
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

const PRICED_SOURCE: SourceRow = {
  id: '00000000-0000-0000-0000-000000000040',
  itemId: ITEM_ROW.id,
  shopId: SHOP_ROW.id,
  sourceUrl: 'https://amazon.com/item',
  price: '19.99',
  currency: 'EUR',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  shop: SHOP_ROW,
}

const UNPRICED_SOURCE: SourceRow = {
  ...PRICED_SOURCE,
  id: '00000000-0000-0000-0000-000000000041',
  shopId: null,
  sourceUrl: null,
  price: null,
  shop: null,
}

interface CategoryLinkRow {
  itemId: string
  categoryId: string
  category: {
    id: string
    parentId: string | null
    slug: string
    depth: number
    translations: { locale: string; name: string }[]
  }
}

interface TagLinkRow {
  itemId: string
  tagId: string
  tag: { id: string; slug: string; name: string }
}

interface ListItemRow {
  id: string
  listId: string
  itemId: string
  quantityDesired: number
  quantityReservedTotal: number
  itemStatus: string
  sortOrder: number | null
  creatorNote: string | null
  createdAt: Date
  updatedAt: Date
  item: typeof ITEM_ROW & {
    sources: SourceRow[]
    itemCategories: CategoryLinkRow[]
    itemTags: TagLinkRow[]
  }
}

interface BuildListItemRowOptions {
  itemCategories?: CategoryLinkRow[]
  itemTags?: TagLinkRow[]
}

function buildListItemRow(
  id: string,
  sortOrder: number | null,
  sources: SourceRow[],
  options: BuildListItemRowOptions = {},
): ListItemRow {
  return {
    id,
    listId: LIST_ROW.id,
    itemId: ITEM_ROW.id,
    quantityDesired: 1,
    quantityReservedTotal: 0,
    itemStatus: 'available',
    sortOrder,
    creatorNote: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    item: {
      ...ITEM_ROW,
      sources,
      itemCategories: options.itemCategories ?? [],
      itemTags: options.itemTags ?? [],
    },
  }
}

const CATEGORY_LINK: CategoryLinkRow = {
  itemId: ITEM_ROW.id,
  categoryId: '00000000-0000-0000-0000-000000000070',
  category: {
    id: '00000000-0000-0000-0000-000000000070',
    parentId: null,
    slug: 'books',
    depth: 0,
    translations: [
      { locale: 'en', name: 'Books' },
      { locale: 'fr', name: 'Livres' },
    ],
  },
}

const TAG_LINK: TagLinkRow = {
  itemId: ITEM_ROW.id,
  tagId: '00000000-0000-0000-0000-000000000080',
  tag: { id: '00000000-0000-0000-0000-000000000080', slug: 'fantasy', name: 'fantasy' },
}

const LIST_ITEM_WITH_PRICED = buildListItemRow(
  '00000000-0000-0000-0000-000000000050',
  10,
  [PRICED_SOURCE],
)
const LIST_ITEM_WITH_MIXED = buildListItemRow(
  '00000000-0000-0000-0000-000000000051',
  20,
  [PRICED_SOURCE, UNPRICED_SOURCE],
)
const LIST_ITEM_WITHOUT_SOURCES = buildListItemRow(
  '00000000-0000-0000-0000-000000000052',
  null,
  [],
)

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

function mockFindListById(row: unknown): void {
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(row as never)
}

function mockFindListItems(rows: ListItemRow[]): void {
  vi.mocked(db.query.listItems.findMany).mockResolvedValueOnce(rows as never)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

interface ListItemAverageRawRow {
  list_item_id: string
  average_price: string
}

function mockListItemAverages(rows: ListItemAverageRawRow[]): void {
  vi.mocked(db.execute).mockResolvedValueOnce(rows as never)
}

describe('GET /v1/admin/lists/:id/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.execute).mockResolvedValue([] as never)
  })

  it('returns 200 with paginated list items including item + full sources[]', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockFindListItems([LIST_ITEM_WITH_PRICED, LIST_ITEM_WITH_MIXED])
    mockCountChain(2)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/items`, { token })

    const body = await response.json() as {
      items: {
        id: string
        item: { id: string }
        sources: { id: string; price: string | null }[]
      }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.pagination.total).toBe(2)
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.item.id).toBe(ITEM_ROW.id)
    expect(body.items[0]?.sources).toHaveLength(1)
    expect(body.items[0]?.sources[0]?.price).toBe('19.99')
    expect(body.items[1]?.sources).toHaveLength(2)
    expect(body.items[1]?.sources.map((source) => source.price)).toEqual(['19.99', null])
  })

  it('returns averagePrice as a USD scalar by default', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockFindListItems([LIST_ITEM_WITH_PRICED])
    mockCountChain(1)
    mockListItemAverages([
      { list_item_id: LIST_ITEM_WITH_PRICED.id, average_price: '21.73' },
    ])

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/items`, { token })

    const body = await response.json() as {
      items: { averagePrice: string | null; displayCurrency: string }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.averagePrice).toBe('21.73')
    expect(body.items[0]?.displayCurrency).toBe('USD')
  })

  it('echoes the requested displayCurrency on each item', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockFindListItems([LIST_ITEM_WITH_PRICED])
    mockCountChain(1)
    mockListItemAverages([
      { list_item_id: LIST_ITEM_WITH_PRICED.id, average_price: '19.99' },
    ])

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/items?currency=EUR`, { token })

    const body = await response.json() as {
      items: { averagePrice: string | null; displayCurrency: string }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.averagePrice).toBe('19.99')
    expect(body.items[0]?.displayCurrency).toBe('EUR')
  })

  it('returns averagePrice=null and echoes displayCurrency when the item has no priced sources', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockFindListItems([LIST_ITEM_WITHOUT_SOURCES])
    mockCountChain(1)
    mockListItemAverages([])

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/items?currency=GBP`, { token })

    const body = await response.json() as {
      items: { averagePrice: string | null; displayCurrency: string }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.averagePrice).toBeNull()
    expect(body.items[0]?.displayCurrency).toBe('GBP')
  })

  it('returns 422 when ?currency is unsupported', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/items?currency=XYZ`, { token })
    expect(response.status).toBe(422)
  })

  it('returns 200 with item.tags and item.categories hydrated (locale picks the right translation)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockFindListItems([
      buildListItemRow('00000000-0000-0000-0000-000000000060', 30, [], {
        itemCategories: [CATEGORY_LINK],
        itemTags: [TAG_LINK],
      }),
    ])
    mockCountChain(1)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/items`, {
      token,
      headers: { 'Accept-Language': 'fr' },
    })

    const body = await response.json() as {
      items: {
        item: {
          categories: { id: string; slug: string; name: string }[]
          tags: { id: string; slug: string; name: string }[]
        }
      }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.item.categories).toEqual([
      { id: CATEGORY_LINK.categoryId, parentId: null, slug: 'books', depth: 0, name: 'Livres' },
    ])
    expect(body.items[0]?.item.tags).toEqual([
      { id: TAG_LINK.tagId, slug: 'fantasy', name: 'fantasy' },
    ])
  })

  it('returns 200 with empty sources[] for list items whose item has no sources', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockFindListItems([LIST_ITEM_WITHOUT_SOURCES])
    mockCountChain(1)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/items`, { token })

    const body = await response.json() as {
      items: { sources: unknown[] }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.sources).toEqual([])
  })

  it('honours pagination query (page=2, limit=1)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockFindListItems([LIST_ITEM_WITH_MIXED])
    mockCountChain(2)

    const response = await apiRequest(
      `/v1/admin/lists/${LIST_ROW.id}/items?page=2&limit=1`,
      { token },
    )

    const body = await response.json() as {
      items: unknown[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }
    expect(response.status).toBe(200)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.limit).toBe(1)
    expect(body.pagination.total).toBe(2)
    expect(body.pagination.totalPages).toBe(2)
  })

  it('returns 404 when the list does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(undefined)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/items`, { token })
    expect(response.status).toBe(404)
  })

  it('returns 404 when the list is soft-deleted', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(DELETED_LIST_ROW)

    const response = await apiRequest(`/v1/admin/lists/${DELETED_LIST_ROW.id}/items`, { token })
    expect(response.status).toBe(404)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/lists/not-a-uuid/items', { token })
    expect(response.status).toBe(422)
  })

  it('returns 403 when the caller is not an admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/items`, { token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/items`)
    expect(response.status).toBe(401)
  })
})
