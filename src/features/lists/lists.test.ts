import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { env } from '../../config/env.js'
import { images } from '../../db/entities/images/images.schema.js'
import { ITEM_SOURCES_SOURCE_URL_UNIQUE_INDEX } from '../../db/entities/item-sources/item-sources.schema.js'
import { ITEMS_GTIN_UNIQUE_INDEX } from '../../db/entities/items/items.schema.js'
import { apiMultipartRequest, apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'
import {
  ADD_ITEM_TARGET_MESSAGE,
  listItemAlreadyExistsMetadataSchema,
  listsAddItemResponseSchema,
  listsCreateResponseSchema,
  listsGetResponseSchema,
  listsListResponseSchema,
  listsUpdateResponseSchema,
  MAX_CUSTOM_NAME_LENGTH,
} from '@keimelion/sdk/schemas'

const { mockProcessImage } = vi.hoisted(() => ({ mockProcessImage: vi.fn() }))

vi.mock('../uploads/image.pipeline.js', () => ({ processImage: mockProcessImage }))

const AUTH_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  username: 'testuser',
  passwordHash: 'hashed',
  authProvider: 'email' as const,
  role: 'user' as const,
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
  activatedAt: new Date('2024-01-01'),
  userStatus: 'active' as const,
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
  role: 'owner' as const,
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
  gtin: null,
  imageId: null,
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
  customName: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(AUTH_USER.id)

function mockAuthChain(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)
}

function mockListAndOwner(list: unknown = MOCK_LIST, owner: unknown = AUTH_USER): void {
  // The listOwnershipMiddleware fetches the list with its owner relation in one query
  // and derives ownership from the embedded collaborator — no separate DB call.
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
    (list && owner !== null ? rowWithOwner(list, owner) : list) as never,
  )
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
  if (owner === null) return { ...row, listUsers: [], listTags: [] }
  const ownerId = (owner as { id: string }).id
  return { ...row, listUsers: [{ userId: ownerId, role: "owner" as const, user: owner }], listTags: [] }
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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
    listsCreateResponseSchema.parse(body)
    expect(response.status).toBe(201)
    expect(body.list.title).toBe('My Wishlist')
    expect(body.list.slug).toBe('my-wishlist-abc123')
  })

  it('creates a list with tags in a single POST and hydrates them in the response', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation(() => {
            const chain = {
              returning: vi.fn().mockImplementationOnce(() => Promise.resolve([MOCK_LIST]))
                .mockImplementationOnce(() => Promise.resolve([MOCK_COLLABORATOR])),
              onConflictDoNothing: vi.fn().mockResolvedValue([]),
            }
            return chain
          }),
        })),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        query: {
          tags: { findMany: vi.fn().mockResolvedValueOnce([TAG_GAMING_ROW]) },
        },
      }
      return (callback as (tx: unknown) => Promise<unknown>)(tx)
    })
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce({
      ...MOCK_LIST,
      listUsers: [{ userId: AUTH_USER.id, role: "owner" as const, user: AUTH_USER }],
      listTags: [listTagLink(TAG_GAMING_ROW)],
    } as never)

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist', tags: ['Gaming'] },
    })

    const body = await response.json() as { list: { tags: { slug: string }[] } }
    expect(response.status).toBe(201)
    expect(body.list.tags.map((tag) => tag.slug)).toEqual(['gaming'])
  })

  it('returns 422 TAG_INVALID_NAME when a tag name normalizes to an empty slug at creation', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest('/v1/lists', {
      method: 'POST',
      token,
      body: { title: 'My Wishlist', tags: ['!!!'] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('TAG_INVALID_NAME')
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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
    listsListResponseSchema.parse(body)
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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 with list detail when caller owns the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { token })

    const body = await response.json() as { list: { title: string; owner: { id: string } | null } }
    listsGetResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.list.title).toBe(MOCK_LIST.title)
    expect(body.list.owner?.id).toBe(AUTH_USER.id)
  })

  it('returns 404 when the list is soft-deleted', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(DELETED_LIST)

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
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      rowWithOwner(MOCK_LIST, null) as never,
    )

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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 with updated list when patching title', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()
    mockUpdateList({ ...MOCK_LIST, title: 'Updated' })

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { title: 'Updated' },
    })

    const body = await response.json() as { list: { title: string } }
    listsUpdateResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.list.title).toBe('Updated')
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

  it('returns 404 when list is soft-deleted', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(DELETED_LIST)

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
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      rowWithOwner(MOCK_LIST, null) as never,
    )

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

  it('replaces tags and refetches hydrated list when tags are provided', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()
    vi.mocked(db.query.tags.findMany).mockResolvedValueOnce([TAG_GAMING_ROW, TAG_READING_ROW] as never)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce({
      ...MOCK_LIST,
      listUsers: [{ userId: AUTH_USER.id, role: "owner" as const, user: AUTH_USER }],
      listTags: [listTagLink(TAG_GAMING_ROW), listTagLink(TAG_READING_ROW)],
    } as never)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { tags: ['Gaming', 'Reading'] },
    })

    const body = await response.json() as { list: { tags: { slug: string }[] } }
    expect(response.status).toBe(200)
    expect(body.list.tags.map((tag) => tag.slug)).toEqual(expect.arrayContaining(['gaming', 'reading']))
  })

  it('clears all tags when tags: [] is sent', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce({
      ...MOCK_LIST,
      listUsers: [{ userId: AUTH_USER.id, role: "owner" as const, user: AUTH_USER }],
      listTags: [],
    } as never)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { tags: [] },
    })

    const body = await response.json() as { list: { tags: unknown[] } }
    expect(response.status).toBe(200)
    expect(body.list.tags).toEqual([])
  })

  it('returns 422 TAG_INVALID_NAME when a tag name normalizes to an empty slug', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListAndOwner()

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { tags: ['!!!'] },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('TAG_INVALID_NAME')
  })

  it('returns 422 when tags exceeds max count (20)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, {
      method: 'PATCH',
      token,
      body: { tags: Array.from({ length: 21 }, (_, i) => `tag-${String(i)}`) },
    })

    expect(response.status).toBe(422)
  })
})

describe('DELETE /v1/lists/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(DELETED_LIST)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { method: 'DELETE', token })
    expect(response.status).toBe(404)
  })

  it('returns 403 when user does not own the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      rowWithOwner(MOCK_LIST, null) as never,
    )

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { method: 'DELETE', token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { method: 'DELETE' })
    expect(response.status).toBe(401)
  })
})

describe('POST /v1/lists/:id/items', () => {
  const OTHER_ITEM_ID = '00000000-0000-0000-0000-000000000021'
  const SOURCE_ID = '00000000-0000-0000-0000-000000000050'
  const OTHER_SOURCE_ID = '00000000-0000-0000-0000-000000000051'
  const SUBMITTED_URL = 'https://amazon.fr/Casque-Audio/dp/B08N5WRWNW/ref=sr_1_1?tag=other-21&utm_source=news'
  const CANONICAL_URL = 'https://www.amazon.fr/dp/B08N5WRWNW'
  const UNKNOWN_SHOP_URL = 'https://tiny-shop.example/product/42'
  const EAN_13 = '4006381333931'
  const PADDED_GTIN = '04006381333931'

  const SHOP_ROW = {
    id: '00000000-0000-0000-0000-000000000060',
    slug: 'amazon',
    name: 'Amazon',
    domain: 'amazon.fr',
    logoUrl: null,
    isAffiliated: false,
    sortOrder: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  const SOURCE_ROW = {
    id: SOURCE_ID,
    itemId: ITEM_ID,
    shopId: SHOP_ROW.id,
    sourceUrl: CANONICAL_URL,
    originalUrl: SUBMITTED_URL,
    affiliateUrl: null,
    price: null,
    currency: 'EUR',
    createdByUserId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  const IMAGE_ROW = {
    id: '00000000-0000-0000-0000-00000000b001',
    hash: 'b'.repeat(64),
    fileKey: 'bb/bb/' + 'b'.repeat(64),
    mime: 'image/png',
    sizeBytes: 4,
    width: 640,
    height: 480,
    uploadedBy: AUTH_USER.id,
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-05-01'),
  }

  const IMAGE_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  const UPLOAD_BODY_LIMIT_OVERFLOW_BYTES = 64 * 1024 + 1

  interface ErrorBody {
    code: string
    message: string
    metadata: { issues?: { path: string; message: string }[]; listItemId?: string; quantityDesired?: number }
  }

  function urlHolder(itemId: string): object {
    return { ...SOURCE_ROW, itemId, shop: SHOP_ROW, item: { ...MOCK_ITEM, id: itemId, image: null } }
  }

  function mockInsertOnce(row?: unknown): ReturnType<typeof vi.fn> {
    const returning = vi.fn().mockResolvedValue(row === undefined ? [] : [row])
    const values = vi.fn().mockReturnValue({ returning, onConflictDoNothing: vi.fn().mockReturnValue({ returning }) })
    vi.mocked(db.insert).mockReturnValueOnce({ values } as never)
    return values
  }

  function mockUpdateOnce(row?: unknown): ReturnType<typeof vi.fn> {
    const returning = vi.fn().mockResolvedValue(row === undefined ? [] : [row])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    vi.mocked(db.update).mockReturnValueOnce({ set } as never)
    return set
  }

  function mockKnownShops(rows: unknown[]): void {
    vi.mocked(db.query.shops.findMany).mockResolvedValueOnce(rows as never)
  }

  function uniqueViolation(constraintName: string = ITEM_SOURCES_SOURCE_URL_UNIQUE_INDEX): Error {
    return Object.assign(new Error('duplicate key'), { code: '23505', constraint_name: constraintName })
  }

  async function postItem(body: unknown): Promise<Response> {
    const token = await generateTestToken(AUTH_USER.id)
    return apiRequest(`/v1/lists/${LIST_ID}/items`, { method: 'POST', token, body })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockProcessImage.mockResolvedValue({ image: IMAGE_ROW })
  })

  describe('with an itemId', () => {
    it('returns 201 and links the existing item with default list item values', async () => {
      mockAuthChain()
      mockListAndOwner()
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
      const values = mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ itemId: ITEM_ID })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.id).toBe(ITEM_ID)
      expect(body.listItem.source).toBeNull()
      expect(values).toHaveBeenCalledWith({
        listId: LIST_ID,
        itemId: ITEM_ID,
        quantityDesired: 1,
        creatorNote: null,
        customName: null,
        itemStatus: 'available',
      })
    })

    it('returns 201 with the customName while keeping the catalogue item name', async () => {
      const customName = 'Grandma birthday gift'
      mockAuthChain()
      mockListAndOwner()
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
      const values = mockInsertOnce({ ...MOCK_LIST_ITEM, customName })

      const response = await postItem({ itemId: ITEM_ID, customName })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.customName).toBe(customName)
      expect(body.listItem.item.name).toBe('My Item')
      expect(values).toHaveBeenCalledWith(expect.objectContaining({ customName }))
    })

    it('returns 404 when the referenced item does not exist', async () => {
      mockAuthChain()
      mockListAndOwner()
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined)

      const response = await postItem({ itemId: ITEM_ID })

      expect(response.status).toBe(404)
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    })

    it('returns 404 before resolving the shop of the submitted URL', async () => {
      mockAuthChain()
      mockListAndOwner()
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined)

      const response = await postItem({ itemId: ITEM_ID, sourceUrl: SUBMITTED_URL })

      expect(response.status).toBe(404)
      expect(vi.mocked(db.query.shops.findMany)).not.toHaveBeenCalled()
    })

    it('attaches a new URL of a known shop as a source of the item, normalized and without price', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(undefined)
      mockInsertOnce(MOCK_LIST_ITEM)
      const sourceValues = mockInsertOnce(SOURCE_ROW)

      const response = await postItem({ itemId: ITEM_ID, sourceUrl: SUBMITTED_URL })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.source?.sourceUrl).toBe(CANONICAL_URL)
      expect(body.listItem.source?.shop?.slug).toBe('amazon')
      expect(sourceValues).toHaveBeenCalledWith({
        itemId: ITEM_ID,
        shopId: SHOP_ROW.id,
        sourceUrl: CANONICAL_URL,
        originalUrl: SUBMITTED_URL,
        affiliateUrl: null,
        price: null,
        currency: 'EUR',
        createdByUserId: AUTH_USER.id,
      })
    })

    it('attaches nothing when the URL is held by another item, and still returns 201', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(urlHolder(OTHER_ITEM_ID) as never)
      mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ itemId: ITEM_ID, sourceUrl: SUBMITTED_URL })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.id).toBe(ITEM_ID)
      expect(body.listItem.source).toBeNull()
      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1)
    })

    it('returns the existing source when the URL is already held by this item', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(urlHolder(ITEM_ID) as never)
      mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ itemId: ITEM_ID, sourceUrl: SUBMITTED_URL })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.source?.id).toBe(SOURCE_ID)
      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1)
    })

    it('attaches nothing when the URL resolves to no known shop', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([])
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(undefined)
      mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ itemId: ITEM_ID, sourceUrl: UNKNOWN_SHOP_URL })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.source).toBeNull()
      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1)
    })

    it('returns the existing source of the item on that shop without inserting a new one', async () => {
      const shopSource = { ...SOURCE_ROW, id: OTHER_SOURCE_ID, sourceUrl: 'https://www.amazon.fr/dp/OTHER', shop: SHOP_ROW }
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
      vi.mocked(db.query.itemSources.findFirst)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(shopSource)
      mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ itemId: ITEM_ID, sourceUrl: SUBMITTED_URL })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.source?.id).toBe(OTHER_SOURCE_ID)
      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1)
    })

    it('returns the source written by a concurrent request when the insert conflicts', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
      vi.mocked(db.query.itemSources.findFirst)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ ...SOURCE_ROW, shop: SHOP_ROW } as never)
      mockInsertOnce(MOCK_LIST_ITEM)
      mockInsertOnce(undefined)

      const response = await postItem({ itemId: ITEM_ID, sourceUrl: SUBMITTED_URL })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.source?.id).toBe(SOURCE_ID)
    })

    it('returns 409 LIST_ITEM_ALREADY_EXISTS with the existing list item id and quantity', async () => {
      mockAuthChain()
      mockListAndOwner()
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
      mockInsertOnce(undefined)
      vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce({ ...MOCK_LIST_ITEM, quantityDesired: 3 } as never)

      const response = await postItem({ itemId: ITEM_ID })

      const body = await response.json() as ErrorBody
      expect(response.status).toBe(409)
      expect(body.code).toBe('LIST_ITEM_ALREADY_EXISTS')
      expect(listItemAlreadyExistsMetadataSchema.parse(body.metadata)).toEqual({
        listItemId: LIST_ITEM_ID,
        quantityDesired: 3,
      })
    })
  })

  describe('with a product payload', () => {
    it('creates a new item without any lookup when the product has neither URL nor GTIN', async () => {
      mockAuthChain()
      mockListAndOwner()
      const itemValues = mockInsertOnce({ ...MOCK_ITEM, name: 'Board game' })
      mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ name: 'Board game', description: 'Coop game' })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.name).toBe('Board game')
      expect(body.listItem.source).toBeNull()
      expect(vi.mocked(db.query.items.findFirst)).not.toHaveBeenCalled()
      expect(vi.mocked(db.query.itemSources.findFirst)).not.toHaveBeenCalled()
      expect(itemValues).toHaveBeenCalledWith({
        name: 'Board game',
        description: 'Coop game',
        gtin: null,
        imageId: null,
        createdByUserId: AUTH_USER.id,
      })
    })

    it('creates the item and its source with the shop resolved, URL normalized and GTIN padded', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(undefined)
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined)
      const itemValues = mockInsertOnce({ ...MOCK_ITEM, gtin: PADDED_GTIN })
      const sourceValues = mockInsertOnce({ ...SOURCE_ROW, price: '19.99' })
      mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ name: 'My Item', sourceUrl: SUBMITTED_URL, gtin: EAN_13, price: '19.99' })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.gtin).toBe(PADDED_GTIN)
      expect(body.listItem.source?.price).toBe('19.99')
      expect(itemValues).toHaveBeenCalledWith(expect.objectContaining({ gtin: PADDED_GTIN }))
      expect(sourceValues).toHaveBeenCalledWith({
        itemId: ITEM_ID,
        shopId: SHOP_ROW.id,
        sourceUrl: CANONICAL_URL,
        originalUrl: SUBMITTED_URL,
        affiliateUrl: null,
        price: '19.99',
        currency: 'EUR',
        createdByUserId: AUTH_USER.id,
      })
    })

    it('reuses the item known by its normalized URL, completes its empty fields, updates the price, stores the name as customName', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(urlHolder(ITEM_ID) as never)
      const values = mockInsertOnce({ ...MOCK_LIST_ITEM, customName: 'Noise cancelling headset' })
      const itemSet = mockUpdateOnce()
      const gtinSet = mockUpdateOnce()
      const sourceSet = mockUpdateOnce({ ...SOURCE_ROW, price: '1.00' })
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce({
        ...MOCK_ITEM,
        description: 'Completed',
        gtin: PADDED_GTIN,
        image: null,
      } as never)

      const response = await postItem({
        name: 'Noise cancelling headset',
        description: 'Completed',
        gtin: EAN_13,
        price: '1.00',
        sourceUrl: SUBMITTED_URL,
      })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.id).toBe(ITEM_ID)
      expect(body.listItem.item.description).toBe('Completed')
      expect(body.listItem.item.gtin).toBe(PADDED_GTIN)
      expect(body.listItem.source?.id).toBe(SOURCE_ID)
      expect(body.listItem.source?.price).toBe('1.00')
      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1)
      expect(itemSet).toHaveBeenCalledWith(expect.objectContaining({ description: expect.anything() as unknown }))
      expect(gtinSet).toHaveBeenCalledWith(expect.objectContaining({ gtin: expect.anything() as unknown }))
      expect(sourceSet).toHaveBeenCalledWith({ price: '1.00' })
      expect(values).toHaveBeenCalledWith(expect.objectContaining({ itemId: ITEM_ID, customName: 'Noise cancelling headset' }))
    })

    it('never overwrites a field the known item already has', async () => {
      const holder = urlHolder(ITEM_ID) as { item: object }
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce({
        ...holder,
        item: { ...holder.item, description: 'Original', gtin: PADDED_GTIN },
      } as never)
      mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ name: MOCK_ITEM.name, description: 'Other', gtin: '5901234123457', sourceUrl: SUBMITTED_URL })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.description).toBe('Original')
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    })

    it('keeps the GTIN empty when another item already holds it', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(urlHolder(ITEM_ID) as never)
      mockInsertOnce(MOCK_LIST_ITEM)
      vi.mocked(db.update).mockImplementationOnce(() => {
        throw uniqueViolation(ITEMS_GTIN_UNIQUE_INDEX)
      })

      const response = await postItem({ name: MOCK_ITEM.name, gtin: EAN_13, sourceUrl: SUBMITTED_URL })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.gtin).toBeNull()
    })

    it('keeps the source price when the submitted currency differs', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(urlHolder(ITEM_ID) as never)
      mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ name: MOCK_ITEM.name, price: '25.00', currency: 'USD', sourceUrl: SUBMITTED_URL })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.source?.price).toBeNull()
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    })

    it('stores no customName when the submitted name equals the catalogue name', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(urlHolder(ITEM_ID) as never)
      const values = mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ name: MOCK_ITEM.name, sourceUrl: SUBMITTED_URL })

      expect(response.status).toBe(201)
      expect(values).toHaveBeenCalledWith(expect.objectContaining({ customName: null }))
    })

    it('keeps an explicit customName over the submitted name', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(urlHolder(ITEM_ID) as never)
      const values = mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ name: 'Other name', customName: 'For dad', sourceUrl: SUBMITTED_URL })

      expect(response.status).toBe(201)
      expect(values).toHaveBeenCalledWith(expect.objectContaining({ customName: 'For dad' }))
    })

    it('reuses the item matched by GTIN and attaches the new URL of a known shop', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(undefined)
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce({ ...MOCK_ITEM, gtin: PADDED_GTIN, image: null } as never)
      mockInsertOnce(MOCK_LIST_ITEM)
      const sourceValues = mockInsertOnce(SOURCE_ROW)

      const response = await postItem({ name: MOCK_ITEM.name, gtin: EAN_13, sourceUrl: SUBMITTED_URL, price: '19.99', currency: 'USD' })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.gtin).toBe(PADDED_GTIN)
      expect(body.listItem.source?.shopId).toBe(SHOP_ROW.id)
      expect(sourceValues).toHaveBeenCalledWith(expect.objectContaining({ itemId: ITEM_ID, price: '19.99', currency: 'USD', createdByUserId: AUTH_USER.id }))
    })

    it('reuses the item created by a concurrent request for the same URL', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(urlHolder(ITEM_ID) as never)
      vi.mocked(db.transaction).mockRejectedValueOnce(uniqueViolation())
      const values = mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postItem({ name: MOCK_ITEM.name, sourceUrl: SUBMITTED_URL })

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.id).toBe(ITEM_ID)
      expect(body.listItem.source?.id).toBe(SOURCE_ID)
      expect(values).toHaveBeenCalledWith(expect.objectContaining({ itemId: ITEM_ID }))
    })

    it('returns 500 instead of retrying when the unique violation is not on the URL or GTIN', async () => {
      mockAuthChain()
      mockListAndOwner()
      vi.mocked(db.transaction).mockRejectedValueOnce(uniqueViolation('tags_slug_unique'))

      const response = await postItem({ name: 'Board game', tags: ['Gaming'] })

      expect(response.status).toBe(500)
      expect(vi.mocked(db.query.itemSources.findFirst)).not.toHaveBeenCalled()
    })

    it('returns 500 when the item write fails for a reason other than a duplicate', async () => {
      mockAuthChain()
      mockListAndOwner()
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('connection lost'))

      const response = await postItem({ name: 'Board game' })

      expect(response.status).toBe(500)
    })
  })

  describe('validation and access', () => {
    it('returns 422 with a targeted message when both itemId and a product are sent', async () => {
      mockAuthChain()
      mockListAndOwner()

      const response = await postItem({ itemId: ITEM_ID, name: 'My Item' })

      const body = await response.json() as ErrorBody
      expect(response.status).toBe(422)
      expect(body.metadata.issues?.[0]?.message).toBe(ADD_ITEM_TARGET_MESSAGE)
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    })

    it('returns 422 on the gtin path when the check digit is invalid', async () => {
      mockAuthChain()
      mockListAndOwner()

      const response = await postItem({ name: 'My Item', gtin: '4006381333932' })

      const body = await response.json() as ErrorBody
      expect(response.status).toBe(422)
      expect(body.metadata.issues?.[0]?.path).toBe('gtin')
    })

    it('returns 422 when customName exceeds the maximum length', async () => {
      mockAuthChain()
      mockListAndOwner()

      const response = await postItem({ itemId: ITEM_ID, customName: 'a'.repeat(MAX_CUSTOM_NAME_LENGTH + 1) })

      const body = await response.json() as ErrorBody
      expect(response.status).toBe(422)
      expect(body.metadata.issues?.[0]?.path).toBe('customName')
      expect(body.metadata.issues?.[0]?.message).toBe(
        `customName must be at most ${String(MAX_CUSTOM_NAME_LENGTH)} characters`,
      )
    })

    it('returns 400 on a malformed JSON body', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuthChain()
      mockListAndOwner()

      const response = await apiRequest(`/v1/lists/${LIST_ID}/items`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(response.status).toBe(400)
    })

    it('returns 403 when the caller is not a contributor of the list', async () => {
      mockAuthChain()
      vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(rowWithOwner(MOCK_LIST, null) as never)

      const response = await postItem({ itemId: ITEM_ID })

      expect(response.status).toBe(403)
    })

    it('returns 404 when the list does not exist', async () => {
      mockAuthChain()
      vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(undefined)

      const response = await postItem({ itemId: ITEM_ID })

      expect(response.status).toBe(404)
    })

    it('returns 422 when the list id param is not a uuid', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuthChain()

      const response = await apiRequest('/v1/lists/not-a-uuid/items', {
        method: 'POST',
        token,
        body: { itemId: ITEM_ID },
      })

      expect(response.status).toBe(422)
    })

    it('returns 401 when not authenticated', async () => {
      const response = await apiRequest(`/v1/lists/${LIST_ID}/items`, { method: 'POST', body: { itemId: ITEM_ID } })

      expect(response.status).toBe(401)
    })
  })

  describe('as multipart/form-data', () => {
    async function postMultipart(fields: Record<string, string>, buffer: Buffer | null): Promise<Response> {
      const token = await generateTestToken(AUTH_USER.id)
      return apiMultipartRequest(`/v1/lists/${LIST_ID}/items`, {
        method: 'POST',
        token,
        fields,
        image: buffer === null ? null : { buffer },
      })
    }

    it('creates the product with the uploaded image and JSON-encoded fields', async () => {
      mockAuthChain()
      mockListAndOwner()
      const itemValues = mockInsertOnce({ ...MOCK_ITEM, imageId: IMAGE_ROW.id })
      const tagValues = mockInsertOnce(undefined)
      const listItemValues = mockInsertOnce({ ...MOCK_LIST_ITEM, quantityDesired: 2 })

      const response = await postMultipart({ name: 'My Item', tags: '["Gaming"]', quantityDesired: '2' }, IMAGE_BUFFER)

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.image?.id).toBe(IMAGE_ROW.id)
      expect(mockProcessImage).toHaveBeenCalledWith(expect.any(Buffer), AUTH_USER.id)
      expect(itemValues).toHaveBeenCalledWith(expect.objectContaining({ imageId: IMAGE_ROW.id }))
      expect(tagValues).toHaveBeenCalledWith([expect.objectContaining({ slug: 'gaming' })])
      expect(listItemValues).toHaveBeenCalledWith(expect.objectContaining({ quantityDesired: 2 }))
    })

    it('sets the uploaded image on a known product that has none', async () => {
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce(urlHolder(ITEM_ID) as never)
      mockInsertOnce(MOCK_LIST_ITEM)
      const itemSet = mockUpdateOnce()
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce({
        ...MOCK_ITEM,
        imageId: IMAGE_ROW.id,
        image: IMAGE_ROW,
      } as never)

      const response = await postMultipart({ name: MOCK_ITEM.name, sourceUrl: SUBMITTED_URL }, IMAGE_BUFFER)

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.image?.id).toBe(IMAGE_ROW.id)
      expect(itemSet).toHaveBeenCalledWith(expect.objectContaining({ imageId: expect.anything() as unknown }))
      expect(vi.mocked(db.delete)).not.toHaveBeenCalled()
    })

    it('sets the uploaded image on an item added by id', async () => {
      mockAuthChain()
      mockListAndOwner()
      vi.mocked(db.query.items.findFirst)
        .mockResolvedValueOnce(MOCK_ITEM)
        .mockResolvedValueOnce({ ...MOCK_ITEM, imageId: IMAGE_ROW.id, image: IMAGE_ROW } as never)
      mockInsertOnce(MOCK_LIST_ITEM)
      mockUpdateOnce()

      const response = await postMultipart({ itemId: ITEM_ID }, IMAGE_BUFFER)

      const body = listsAddItemResponseSchema.parse(await response.json())
      expect(response.status).toBe(201)
      expect(body.listItem.item.image?.id).toBe(IMAGE_ROW.id)
    })

    it('does not process the uploaded image when the known product already has one', async () => {
      const holder = urlHolder(ITEM_ID) as { item: object }
      mockAuthChain()
      mockListAndOwner()
      mockKnownShops([SHOP_ROW])
      vi.mocked(db.query.itemSources.findFirst).mockResolvedValueOnce({
        ...holder,
        item: { ...holder.item, imageId: IMAGE_ROW.id, image: IMAGE_ROW },
      } as never)
      mockInsertOnce(MOCK_LIST_ITEM)

      const response = await postMultipart({ name: MOCK_ITEM.name, sourceUrl: SUBMITTED_URL }, IMAGE_BUFFER)

      expect(response.status).toBe(201)
      expect(mockProcessImage).not.toHaveBeenCalled()
    })

    it('rolls the uploaded image back when the item is already in the list', async () => {
      mockAuthChain()
      mockListAndOwner()
      vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
      mockInsertOnce(undefined)
      vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(MOCK_LIST_ITEM as never)

      const response = await postMultipart({ itemId: ITEM_ID }, IMAGE_BUFFER)

      expect(response.status).toBe(409)
      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1)
    })

    it('rolls the new image row back when the item write fails', async () => {
      mockAuthChain()
      mockListAndOwner()
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('connection lost'))

      const response = await postMultipart({ name: 'My Item' }, IMAGE_BUFFER)

      expect(response.status).toBe(500)
      expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
    })

    it('returns 422 when tags is not valid JSON', async () => {
      mockAuthChain()
      mockListAndOwner()

      const response = await postMultipart({ name: 'My Item', tags: 'not-json' }, null)

      expect(response.status).toBe(422)
      expect(mockProcessImage).not.toHaveBeenCalled()
    })

    it('returns 413 PAYLOAD_TOO_LARGE from the body limit', async () => {
      mockAuthChain()
      mockListAndOwner()

      const oversized = Buffer.alloc(env.UPLOADS_MAX_SIZE_BYTES + UPLOAD_BODY_LIMIT_OVERFLOW_BYTES)
      const response = await postMultipart({ name: 'My Item' }, oversized)

      const body = await response.json() as ErrorBody
      expect(response.status).toBe(413)
      expect(body.code).toBe('PAYLOAD_TOO_LARGE')
      expect(mockProcessImage).not.toHaveBeenCalled()
    })
  })
})

const TAG_GAMING_ROW = {
  id: '00000000-0000-0000-0000-000000000070',
  name: 'gaming',
  slug: 'gaming',
  createdByUserId: AUTH_USER.id,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const TAG_READING_ROW = {
  ...TAG_GAMING_ROW,
  id: '00000000-0000-0000-0000-000000000071',
  name: 'reading',
  slug: 'reading',
}

function listTagLink(tag: typeof TAG_GAMING_ROW): {
  listId: string
  tagId: string
  assignedAt: Date
  tag: typeof TAG_GAMING_ROW
} {
  return { listId: LIST_ID, tagId: tag.id, assignedAt: new Date('2024-02-01'), tag }
}


describe('lists mapper hydrates tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns tags array on GET /v1/lists/:id', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce({
      ...MOCK_LIST,
      listUsers: [{ userId: AUTH_USER.id, role: "owner" as const, user: AUTH_USER }],
      listTags: [listTagLink(TAG_GAMING_ROW)],
    } as never)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { token })

    const body = await response.json() as { list: { tags: { slug: string }[] } }
    expect(response.status).toBe(200)
    expect(body.list.tags).toHaveLength(1)
    expect(body.list.tags[0]?.slug).toBe('gaming')
  })

  it('returns tags array on GET /v1/lists (paginated)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockOwnedListsSubquery([LIST_ID])
    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([
      {
        ...MOCK_LIST,
        listUsers: [{ userId: AUTH_USER.id, role: "owner" as const, user: AUTH_USER }],
        listTags: [listTagLink(TAG_READING_ROW)],
      },
    ] as never)
    mockCountChain(1)
    mockOwnedListsSubquery([LIST_ID])

    const response = await apiRequest('/v1/lists', { token })

    const body = await response.json() as { items: { tags: { slug: string }[] }[] }
    expect(response.status).toBe(200)
    expect(body.items[0]?.tags[0]?.slug).toBe('reading')
  })
})
