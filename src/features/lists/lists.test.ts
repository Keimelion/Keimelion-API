import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'

const AUTH_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  username: 'testuser',
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

const LIST_ID = '00000000-0000-0000-0000-000000000010'
const ITEM_ID = '00000000-0000-0000-0000-000000000020'
const LIST_ITEM_ID = '00000000-0000-0000-0000-000000000030'

const MOCK_LIST = {
  id: LIST_ID,
  occasionTypeId: null,
  title: 'My Wishlist',
  slug: 'my-wishlist',
  description: null,
  eventDate: null,
  listStatus: 'active' as const,
  isGalleryPublic: false,
  isTemplate: false,
  templateSourceId: null,
  viewCount: 0,
  importCount: 0,
  archivedAt: null,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const MOCK_COLLABORATOR = {
  id: '00000000-0000-0000-0000-000000000040',
  listId: LIST_ID,
  userId: AUTH_USER.id,
  invitedEmail: null,
  collabRole: 'owner' as const,
  inviteStatus: 'accepted',
  inviteToken: null,
  inviteTokenExpiresAt: null,
  invitedAt: new Date('2024-01-01'),
  acceptedAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const MOCK_ITEM = {
  id: ITEM_ID,
  name: 'My Item',
  description: null,
  imageUrl: null,
  locale: 'fr',
  createdByUserId: AUTH_USER.id,
  moderationStatus: 'approved',
  addCount: 0,
  reserveCount: 0,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const MOCK_LIST_ITEM = {
  id: LIST_ITEM_ID,
  listId: LIST_ID,
  itemId: ITEM_ID,
  quantityDesired: 1,
  quantityReservedTotal: 0,
  itemStatus: 'available',
  sortOrder: null,
  creatorNote: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(AUTH_USER.id)

function mockAuthChain(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)
}

function mockListAndOwner(): void {
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
  vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_COLLABORATOR as never)
}

function mockItemInsert(): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([MOCK_ITEM]),
    }),
  } as never)
}

function mockListItemInsert(): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([MOCK_LIST_ITEM]),
    }),
  } as never)
}

describe('POST /v1/lists/:id/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 with created list item when owner posts valid body', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()
    mockItemInsert()
    mockListItemInsert()

    const response = await apiRequest(`/v1/lists/${LIST_ID}/items`, {
      method: 'POST',
      token,
      body: { name: 'My New Item' },
    })

    const body = await response.json() as { listItem: { item: { name: string }; itemStatus: string } }
    expect(response.status).toBe(201)
    expect(body.listItem.item.name).toBe('My Item')
    expect(body.listItem.itemStatus).toBe('available')
  })

  it('returns 422 when name is missing', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)

    const response = await apiRequest(`/v1/lists/${LIST_ID}/items`, {
      method: 'POST',
      token,
      body: { description: 'no name here' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when imageUrl is not a valid URL', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)

    const response = await apiRequest(`/v1/lists/${LIST_ID}/items`, {
      method: 'POST',
      token,
      body: { name: 'Valid', imageUrl: 'not-a-url' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not owner of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/lists/${LIST_ID}/items`, {
      method: 'POST',
      token,
      body: { name: 'Item' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 404 when list does not exist', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/lists/${LIST_ID}/items`, {
      method: 'POST',
      token,
      body: { name: 'Item' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when list id param is not a uuid', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)

    const response = await apiRequest('/v1/lists/not-a-uuid/items', {
      method: 'POST',
      token,
      body: { name: 'Item' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/lists/${LIST_ID}/items`, {
      method: 'POST',
      body: { name: 'Item' },
    })

    expect(response.status).toBe(401)
  })
})

describe('POST /v1/lists/:id/items/from-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 with article pre-filled from OG tags when URL is valid', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()
    mockItemInsert()

    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{
          id: '00000000-0000-0000-0000-000000000050',
          itemId: ITEM_ID,
          shopName: null,
          sourceUrl: 'https://example.com/product',
          price: null,
          currency: 'EUR',
          affiliatePartner: null,
          affiliateUrl: null,
          isDomainTrusted: false,
          isPrimary: true,
          addedVia: 'url',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        }]),
      }),
    } as never)

    mockListItemInsert()

    const response = await apiRequest(`/v1/lists/${LIST_ID}/items/from-url`, {
      method: 'POST',
      token,
      body: { url: 'https://example.com/product' },
    })

    expect(response.status).toBe(201)
    const body = await response.json() as { listItem: { itemStatus: string } }
    expect(body.listItem.itemStatus).toBe('available')
  })

  it('returns 201 with minimal article when URL is unreachable', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()

    const unreachableItem = { ...MOCK_ITEM, name: 'https://unreachable.example.com/product' }
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([unreachableItem]),
      }),
    } as never)

    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{
          id: '00000000-0000-0000-0000-000000000050',
          itemId: ITEM_ID,
          shopName: null,
          sourceUrl: 'https://unreachable.example.com/product',
          price: null,
          currency: 'EUR',
          affiliatePartner: null,
          affiliateUrl: null,
          isDomainTrusted: false,
          isPrimary: true,
          addedVia: 'url',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        }]),
      }),
    } as never)

    mockListItemInsert()

    const response = await apiRequest(`/v1/lists/${LIST_ID}/items/from-url`, {
      method: 'POST',
      token,
      body: { url: 'https://unreachable.example.com/product' },
    })

    expect(response.status).toBe(201)
  })

  it('returns 422 when URL is malformed', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)

    const response = await apiRequest(`/v1/lists/${LIST_ID}/items/from-url`, {
      method: 'POST',
      token,
      body: { url: 'not-a-valid-url' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not owner of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/lists/${LIST_ID}/items/from-url`, {
      method: 'POST',
      token,
      body: { url: 'https://example.com/product' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/lists/${LIST_ID}/items/from-url`, {
      method: 'POST',
      body: { url: 'https://example.com/product' },
    })

    expect(response.status).toBe(401)
  })
})
