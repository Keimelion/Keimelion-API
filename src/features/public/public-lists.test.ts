import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'

const OWNER_USER = {
  id: '00000000-0000-0000-0000-000000000001',
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
  defaultCurrencyCode: 'USD',
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
  avatarImage: null,
}

const LIST_ID = '00000000-0000-0000-0000-000000000010'
const ITEM_ID = '00000000-0000-0000-0000-000000000020'
const LIST_ITEM_ID = '00000000-0000-0000-0000-000000000030'
const LIST_SLUG = 'my-shared-wishlist'

const PUBLIC_LIST_ROW = {
  id: LIST_ID,
  occasionTypeId: null,
  title: 'My Shared Wishlist',
  slug: LIST_SLUG,
  description: 'A list to share',
  listStatus: 'active' as const,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  collaborators: [
    {
      id: '00000000-0000-0000-0000-000000000040',
      listId: LIST_ID,
      userId: OWNER_USER.id,
      invitedEmail: null,
      collabRole: 'owner' as const,
      inviteStatus: 'accepted',
      inviteToken: null,
      inviteTokenExpiresAt: null,
      acceptedAt: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      user: OWNER_USER,
    },
  ],
  listTags: [],
  listItems: [
    {
      id: LIST_ITEM_ID,
      listId: LIST_ID,
      itemId: ITEM_ID,
      quantityDesired: 1,
      quantityReservedTotal: 0,
      itemStatus: 'available' as const,
      sortOrder: null,
      creatorNote: null,
      imageId: null,
      image: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      item: {
        id: ITEM_ID,
        name: 'A nice item',
        description: null,
        imageUrl: null,
        createdByUserId: OWNER_USER.id,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        sources: [],
        itemCategories: [],
        itemTags: [],
      },
    },
  ],
}

interface PublicListResponse {
  list: {
    id: string
    title: string
    slug: string
    description: string | null
    occasionTypeId: string | null
    owner: { id: string; username: string | null } | null
    tags: unknown[]
    items: { id: string; itemStatus: string; item: { id: string; name: string } }[]
  }
}

describe('GET /v1/public/lists/:slug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with the public list payload when the slug exists', async () => {
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(PUBLIC_LIST_ROW)

    const response = await apiRequest(`/v1/public/lists/${LIST_SLUG}`)
    const body = await response.json() as PublicListResponse

    expect(response.status).toBe(200)
    expect(body.list.id).toBe(LIST_ID)
    expect(body.list.slug).toBe(LIST_SLUG)
    expect(body.list.owner?.id).toBe(OWNER_USER.id)
    expect(body.list.owner?.username).toBe('owner')
    expect(body.list.items).toHaveLength(1)
    expect(body.list.items[0]?.itemStatus).toBe('available')
    expect(body.list.items[0]?.item.name).toBe('A nice item')
  })

  it('surfaces the stored itemStatus so reserved items appear as reserved', async () => {
    const reservedRow = {
      ...PUBLIC_LIST_ROW,
      listItems: [
        {
          ...PUBLIC_LIST_ROW.listItems[0],
          quantityReservedTotal: 1,
          itemStatus: 'reserved' as const,
        },
      ],
    }
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(reservedRow)

    const response = await apiRequest(`/v1/public/lists/${LIST_SLUG}`)
    const body = await response.json() as PublicListResponse

    expect(response.status).toBe(200)
    expect(body.list.items[0]?.itemStatus).toBe('reserved')
  })

  it('returns 404 when the slug does not match any list', async () => {
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/public/lists/${LIST_SLUG}`)

    expect(response.status).toBe(404)
  })

  it('returns 404 when the list exists but is soft-deleted (findFirst filtered)', async () => {
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/public/lists/soft-deleted-list')

    expect(response.status).toBe(404)
  })

  it('returns 422 when the slug fails the slug regex validation', async () => {
    const response = await apiRequest('/v1/public/lists/Not%20A%20Slug')

    expect(response.status).toBe(422)
  })

  it('does not expose owner email, password hash, or any raw user fields', async () => {
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(PUBLIC_LIST_ROW)

    const response = await apiRequest(`/v1/public/lists/${LIST_SLUG}`)
    const raw = await response.text()

    expect(response.status).toBe(200)
    expect(raw).not.toContain('owner@example.com')
    expect(raw).not.toContain('passwordHash')
    expect(raw).not.toContain('password_hash')
    expect(raw).not.toContain('hashed')
    expect(raw).not.toContain('isCgvAccepted')
    expect(raw).not.toContain('emailVerifiedAt')
    expect(raw).not.toContain('reservations')
    expect(raw).not.toContain('reservedBy')
    expect(raw).not.toContain('reserverId')
  })

  it('does not expose reservation records on list items', async () => {
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(PUBLIC_LIST_ROW)

    const response = await apiRequest(`/v1/public/lists/${LIST_SLUG}`)
    const body = await response.json() as { list: { items: Record<string, unknown>[] } }

    expect(response.status).toBe(200)
    const [first] = body.list.items
    expect(first).toBeDefined()
    expect(first).not.toHaveProperty('reservations')
    expect(first).not.toHaveProperty('reservedBy')
  })

  it('is reachable without an Authorization header (no auth middleware)', async () => {
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(PUBLIC_LIST_ROW)

    const response = await apiRequest(`/v1/public/lists/${LIST_SLUG}`)

    expect(response.status).toBe(200)
    expect(vi.mocked(db.query.accessTokens.findFirst)).not.toHaveBeenCalled()
  })

  it('is reachable even when the caller sends a stale bearer token (no auth evaluated)', async () => {
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(PUBLIC_LIST_ROW)

    const response = await apiRequest(`/v1/public/lists/${LIST_SLUG}`, {
      token: 'any-stale-token',
    })

    expect(response.status).toBe(200)
    expect(vi.mocked(db.query.accessTokens.findFirst)).not.toHaveBeenCalled()
  })
})
