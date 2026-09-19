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
  description: null,
  listStatus: 'active' as const,
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
  acceptedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const MOCK_EDITOR_COLLABORATOR = {
  ...MOCK_COLLABORATOR,
  id: '00000000-0000-0000-0000-000000000041',
  collabRole: 'editor' as const,
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

function mockListItemOwnershipChain(): void {
  vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(MOCK_LIST_ITEM as never)
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
  vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_COLLABORATOR as never)
}

describe('PATCH /v1/list-items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with updated list item', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()

    const updatedListItem = { ...MOCK_LIST_ITEM, quantityDesired: 3 }
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([updatedListItem]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { quantityDesired: 3 },
    })

    const body = await response.json() as { listItem: { quantityDesired: number } }
    expect(response.status).toBe(200)
    expect(body.listItem.quantityDesired).toBe(3)
  })

  it('returns 200 when updating creatorNote to null', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()

    const updatedListItem = { ...MOCK_LIST_ITEM, creatorNote: null }
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([updatedListItem]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { creatorNote: null },
    })

    expect(response.status).toBe(200)
  })

  it('returns 200 when user is an editor of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(MOCK_LIST_ITEM as never)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_EDITOR_COLLABORATOR as never)

    const updatedListItem = { ...MOCK_LIST_ITEM, quantityDesired: 5 }
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([updatedListItem]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { quantityDesired: 5 },
    })

    const body = await response.json() as { listItem: { quantityDesired: number } }
    expect(response.status).toBe(200)
    expect(body.listItem.quantityDesired).toBe(5)
  })

  it('returns 403 when user is not a contributor of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(MOCK_LIST_ITEM as never)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { quantityDesired: 3 },
    })

    expect(response.status).toBe(403)
  })

  it('returns 404 when list item does not exist', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { quantityDesired: 3 },
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when body is empty', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: {},
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when id param is not a uuid', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)

    const response = await apiRequest('/v1/list-items/not-a-uuid', {
      method: 'PATCH',
      token,
      body: { quantityDesired: 1 },
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      body: { quantityDesired: 1 },
    })

    expect(response.status).toBe(401)
  })
})

describe('DELETE /v1/list-items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with success message on delete', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()

    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([MOCK_LIST_ITEM]),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'DELETE',
      token,
    })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('Item removed from list')
  })

  it('returns 403 when user is not owner of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(MOCK_LIST_ITEM as never)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 404 when list item does not exist', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when id param is not a uuid', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)

    const response = await apiRequest('/v1/list-items/not-a-uuid', {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(401)
  })
})
