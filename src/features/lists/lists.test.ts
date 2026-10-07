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
  slug: 'my-wishlist-abc123',
  description: null,
  listStatus: 'active' as const,
  eventDate: null,
  isGalleryPublic: false,
  archivedAt: null,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const DELETED_LIST = { ...MOCK_LIST, deletedAt: new Date('2024-06-01') }

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

const MOCK_ITEM = {
  id: ITEM_ID,
  name: 'My Item',
  description: null,
  imageUrl: null,
  createdByUserId: AUTH_USER.id,
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

function mockListAndOwner(list: unknown = MOCK_LIST, owner: unknown = AUTH_USER): void {
  // The listOwnershipMiddleware now fetches the list with its owner relation in a
  // single query and exposes it in context. The service re-reads that value instead
  // of hitting the DB again, so tests only need the one findFirst + the collaborator
  // check (ownership assertion).
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
    (list && owner !== null ? rowWithOwner(list as object, owner) : list) as never,
  )
  vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_COLLABORATOR as never)
}

function mockTransactionInserts(rows: unknown[]): void {
  const queue = [...rows]
  vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
    const insertResults = queue
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue(insertResults.length ? [insertResults.shift()] : []),
        })),
      })),
    }
    return (callback as (tx: unknown) => Promise<unknown>)(tx)
  })
}

function mockOwnedListsSubquery(listIds: string[]): void {
  // The findListsOwnedBy/countListsOwnedBy repository functions build a lazy
  // subquery via db.select(...).from(listCollaborators).where(...). In production
  // Drizzle serialises it into a correlated subquery; the mock chain here just
  // needs to be consumed so the test does not blow the global db.select queue.
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce(listIds.map((listId) => ({ id: listId }))),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function rowWithOwner(row: object, owner: unknown): object {
  return { ...row, collaborators: owner === null ? [] : [{ user: owner }] }
}

function mockUpdateList(returnRow: unknown): void {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([returnRow]),
      }),
    }),
  } as never)
}

function mockUpdateListRejects(error: unknown): void {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockRejectedValueOnce(error),
      }),
    }),
  } as never)
}

describe('POST /v1/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 201 with created list when body is valid', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockTransactionInserts([MOCK_LIST, MOCK_COLLABORATOR])

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist' },
    })

    const body = await response.json() as { list: { title: string; slug: string } }
    expect(response.status).toBe(201)
    expect(body.list.title).toBe('My Wishlist')
    expect(body.list.slug).toBe('my-wishlist-abc123')
  })

  it('persists owner collaborator inside the same transaction (both inserts in the callback)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    const txInsert = vi.fn()
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      let callIndex = 0
      txInsert.mockImplementation(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValueOnce(callIndex === 0 ? [MOCK_LIST] : [MOCK_COLLABORATOR]),
        })),
      }))
      const tx = {
        insert: vi.fn().mockImplementation((...args: unknown[]) => {
          const result = txInsert(...args) as unknown
          callIndex += 1
          return result
        }),
      }
      return (callback as (tx: unknown) => Promise<unknown>)(tx)
    })

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist' },
    })

    expect(response.status).toBe(201)
    expect(txInsert).toHaveBeenCalledTimes(2)
  })

  it('retries on slug unique violation up to 3 times then returns 409', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.transaction).mockImplementation(() => {
      const error = Object.assign(new Error('unique'), { code: '23505' })
      return Promise.reject(error)
    })

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('SLUG_GENERATION_EXHAUSTED')
    expect(vi.mocked(db.transaction)).toHaveBeenCalledTimes(3)
  })

  it('retries once on slug collision and succeeds on second attempt', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.transaction).mockImplementationOnce(() => {
      const error = Object.assign(new Error('unique'), { code: '23505' })
      return Promise.reject(error)
    })
    mockTransactionInserts([MOCK_LIST, MOCK_COLLABORATOR])

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist' },
    })

    expect(response.status).toBe(201)
    expect(vi.mocked(db.transaction)).toHaveBeenCalledTimes(2)
  })

  it('rolls back the whole transaction when the owner collaborator insert fails (service returns 500)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      let callIndex = 0
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockImplementation(() =>
              callIndex++ === 0 ? Promise.resolve([MOCK_LIST]) : Promise.resolve([]),
            ),
          })),
        })),
      }
      return (callback as (tx: unknown) => Promise<unknown>)(tx)
    })

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist' },
    })

    expect(response.status).toBe(500)
  })

  it('returns 422 when title is missing', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: {},
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when title is empty string', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: '' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when unknown field is sent (strict schema)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist', bogus: 'nope' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when occasionTypeId FK violation surfaces from the DB', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.transaction).mockImplementationOnce(() => {
      const error = Object.assign(new Error('fk'), { code: '23503' })
      return Promise.reject(error)
    })

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist', occasionTypeId: '00000000-0000-0000-0000-000000000099' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('UNPROCESSABLE_ENTITY')
  })

  it('returns 422 when eventDate is not a real calendar date (2024-02-30)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist', eventDate: '2024-02-30' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when eventDate is garbage (9999-99-99)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist', eventDate: '9999-99-99' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      body: { title: 'My Wishlist' },
    })
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated owned lists', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockOwnedListsSubquery([LIST_ID])
    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([
      rowWithOwner(MOCK_LIST, AUTH_USER),
    ] as never)
    mockCountChain(1)
    mockOwnedListsSubquery([LIST_ID])

    const response = await apiRequest('/v1/lists', { token })

    const body = await response.json() as {
      items: { id: string; owner: { id: string } }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.items[0]?.id).toBe(LIST_ID)
  })

  it('returns an empty page when user owns no lists', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockOwnedListsSubquery([])
    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([] as never)
    mockCountChain(0)
    mockOwnedListsSubquery([])

    const response = await apiRequest('/v1/lists', { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it('returns 422 when sort field is invalid', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest('/v1/lists?sort=bogus:asc', { token })
    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/lists')
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/lists/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with list detail when caller owns the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { token })

    const body = await response.json() as { list: { title: string; owner: { id: string } | null } }
    expect(response.status).toBe(200)
    expect(body.list.title).toBe(MOCK_LIST.title)
    expect(body.list.owner?.id).toBe(AUTH_USER.id)
  })

  it('returns 404 when the list is soft-deleted', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(DELETED_LIST as never)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { token })
    expect(response.status).toBe(404)
  })

  it('returns 404 when the list does not exist', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { token })
    expect(response.status).toBe(404)
  })

  it('returns 403 when caller does not own the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { token })
    expect(response.status).toBe(403)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest('/v1/lists/not-a-uuid', { token })
    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/lists/${LIST_ID}`)
    expect(response.status).toBe(401)
  })
})

describe('PATCH /v1/lists/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with updated list when patching title', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()
    mockUpdateList({ ...MOCK_LIST, title: 'Updated' })
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      rowWithOwner({ ...MOCK_LIST, title: 'Updated' }, AUTH_USER) as never,
    )

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { title: 'Updated' },
    })

    const body = await response.json() as { list: { title: string } }
    expect(response.status).toBe(200)
    expect(body.list.title).toBe('Updated')
  })

  it('sets archivedAt when transitioning listStatus from active to archived', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()
    mockUpdateList({ ...MOCK_LIST, listStatus: 'archived', archivedAt: new Date() })
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      rowWithOwner({ ...MOCK_LIST, listStatus: 'archived', archivedAt: new Date() }, AUTH_USER) as never,
    )

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { listStatus: 'archived' },
    })

    const body = await response.json() as { list: { listStatus: string; archivedAt: string | null } }
    expect(response.status).toBe(200)
    expect(body.list.listStatus).toBe('archived')
    expect(body.list.archivedAt).not.toBeNull()
  })

  it('returns 422 when body is empty', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: {},
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when unknown field is sent (strict schema)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { bogus: 'nope' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when listStatus is deleted (user cannot set deleted via PATCH)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { listStatus: 'deleted' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when occasionTypeId FK violation surfaces from the DB', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()
    mockUpdateListRejects({ code: '23503' })

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { occasionTypeId: '00000000-0000-0000-0000-000000000099' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when eventDate is not a real calendar date (2024-02-30)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { eventDate: '2024-02-30' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 404 when list is soft-deleted', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(DELETED_LIST as never)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { title: 'Updated' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 403 when user does not own the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { title: 'Updated' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      body: { title: 'Updated' },
    })

    expect(response.status).toBe(401)
  })
})

describe('DELETE /v1/lists/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 204 when soft-deleting an owned active list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()
    mockUpdateList({ ...MOCK_LIST, deletedAt: new Date() })

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { method: 'DELETE', token })
    expect(response.status).toBe(204)
  })

  it('returns 404 when the list is already soft-deleted', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(DELETED_LIST as never)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { method: 'DELETE', token })
    expect(response.status).toBe(404)
  })

  it('returns 403 when user does not own the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { method: 'DELETE', token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { method: 'DELETE' })
    expect(response.status).toBe(401)
  })
})

describe('POST /v1/lists/:id/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 with created list item when owner posts valid body', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()
    mockTransactionInserts([MOCK_ITEM, MOCK_LIST_ITEM])

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
