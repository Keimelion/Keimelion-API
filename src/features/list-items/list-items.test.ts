import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'
import {
  listItemsCreateResponseSchema,
  listItemsUpdateResponseSchema,
  MAX_CUSTOM_NAME_LENGTH,
  messageResponseSchema,
} from '@keimelion/sdk/schemas'

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

const CUSTOM_NAME = 'Blue headphones for the office'
const TOO_LONG_CUSTOM_NAME = 'a'.repeat(MAX_CUSTOM_NAME_LENGTH + 1)

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(AUTH_USER.id)

const MOCK_ITEM = {
  id: ITEM_ID,
  name: 'Test Item',
  description: null,
  imageId: null,
  createdByUserId: AUTH_USER.id,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

function mockAuthChain(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)
}

function mockOwnerListChain(): void {
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
    { ...MOCK_LIST, listUsers: [{ userId: AUTH_USER.id, role: 'owner' as const, user: AUTH_USER }] } as never,
  )
}

function mockInsertReturning(row: object): ReturnType<typeof vi.fn> {
  const values = vi.fn().mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([row]) })
  vi.mocked(db.insert).mockReturnValueOnce({ values } as never)
  return values
}

function mockUpdateReturning(row: object): ReturnType<typeof vi.fn> {
  const set = vi.fn().mockReturnValueOnce({
    where: vi.fn().mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([row]) }),
  })
  vi.mocked(db.update).mockReturnValueOnce({ set } as never)
  return set
}

function mockListItemOwnershipChain(): void {
  vi.mocked(db.query.listItems.findFirst).mockResolvedValue(MOCK_LIST_ITEM as never)
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
    { ...MOCK_LIST, listUsers: [{ userId: AUTH_USER.id, role: "owner" as const, user: AUTH_USER }] } as never,
  )
}

describe('POST /v1/list-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 with created list item for JSON body', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, listUsers: [{ userId: AUTH_USER.id, role: "owner" as const, user: AUTH_USER }] } as never,
    )
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([MOCK_LIST_ITEM]),
      }),
    } as never)

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: LIST_ID, itemId: ITEM_ID, quantityDesired: 2 },
    })

    const body = await response.json() as { listItem: Record<string, unknown> }
    listItemsCreateResponseSchema.parse(body)
    expect(response.status).toBe(201)
    expect(body.listItem.listId).toBe(LIST_ID)
    expect(body.listItem).not.toHaveProperty('image')
    expect(body.listItem).not.toHaveProperty('imageId')
  })

  it('returns 404 when the referenced item does not exist', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, listUsers: [{ userId: AUTH_USER.id, role: "owner" as const, user: AUTH_USER }] } as never,
    )
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: LIST_ID, itemId: ITEM_ID },
    })

    expect(response.status).toBe(404)
  })

  it('returns 403 when the user is not a contributor of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, listUsers: [], listTags: [] } as never,
    )

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: LIST_ID, itemId: ITEM_ID },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      body: { listId: LIST_ID, itemId: ITEM_ID },
    })

    expect(response.status).toBe(401)
  })

  it('returns 201 and persists a trimmed customName', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockOwnerListChain()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
    const values = mockInsertReturning({ ...MOCK_LIST_ITEM, customName: CUSTOM_NAME })

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: LIST_ID, itemId: ITEM_ID, customName: `  ${CUSTOM_NAME}  ` },
    })

    const body = listItemsCreateResponseSchema.parse(await response.json())
    expect(response.status).toBe(201)
    expect(body.listItem.customName).toBe(CUSTOM_NAME)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ customName: CUSTOM_NAME }))
  })

  it('defaults customName to null when omitted', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockOwnerListChain()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM)
    const values = mockInsertReturning(MOCK_LIST_ITEM)

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: LIST_ID, itemId: ITEM_ID },
    })

    const body = listItemsCreateResponseSchema.parse(await response.json())
    expect(response.status).toBe(201)
    expect(body.listItem.customName).toBeNull()
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ customName: null }))
  })

  it('returns 422 when customName exceeds the maximum length', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockOwnerListChain()

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: LIST_ID, itemId: ITEM_ID, customName: TOO_LONG_CUSTOM_NAME },
    })

    const body = await response.json() as { metadata: { issues: { path: string; message: string }[] } }
    expect(response.status).toBe(422)
    expect(body.metadata.issues[0]?.path).toBe('customName')
    expect(body.metadata.issues[0]?.message).toBe(
      `customName must be at most ${String(MAX_CUSTOM_NAME_LENGTH)} characters`,
    )
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
  })

  it('returns 422 when listId is not a UUID', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, listUsers: [{ userId: AUTH_USER.id, role: "owner" as const, user: AUTH_USER }] } as never,
    )

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: 'not-a-uuid', itemId: ITEM_ID },
    })

    expect(response.status).toBe(422)
  })
})

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
    listItemsUpdateResponseSchema.parse(body)
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

  it('returns 200 and sets the customName', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()
    const set = mockUpdateReturning({ ...MOCK_LIST_ITEM, customName: CUSTOM_NAME })

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { customName: CUSTOM_NAME },
    })

    const body = listItemsUpdateResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.listItem.customName).toBe(CUSTOM_NAME)
    expect(set).toHaveBeenCalledWith({ customName: CUSTOM_NAME })
  })

  it.each([null, '   '])('returns 200 and clears the customName when %j is sent', async (customName) => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()
    const set = mockUpdateReturning(MOCK_LIST_ITEM)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { customName },
    })

    const body = listItemsUpdateResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.listItem.customName).toBeNull()
    expect(set).toHaveBeenCalledWith({ customName: null })
  })

  it('returns 422 when customName exceeds the maximum length', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { customName: TOO_LONG_CUSTOM_NAME },
    })

    const body = await response.json() as { metadata: { issues: { path: string; message: string }[] } }
    expect(response.status).toBe(422)
    expect(body.metadata.issues[0]?.path).toBe('customName')
    expect(body.metadata.issues[0]?.message).toBe(
      `customName must be at most ${String(MAX_CUSTOM_NAME_LENGTH)} characters`,
    )
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })

  it('returns 200 when user is an editor of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValue(MOCK_LIST_ITEM as never)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      {
        ...MOCK_LIST,
        listUsers: [{ userId: AUTH_USER.id, role: 'editor' as const, user: AUTH_USER }],
        listTags: [],
      } as never,
    )

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
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, listUsers: [], listTags: [] } as never,
    )

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

  it('returns 422 NO_FIELDS_TO_UPDATE when body is empty', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: {},
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('NO_FIELDS_TO_UPDATE')
  })

  it('returns 422 when id param is not a uuid', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
    messageResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.message).toBe('Item removed from list')
  })

  it('returns 200 when user is an editor of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(MOCK_LIST_ITEM as never)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      {
        ...MOCK_LIST,
        listUsers: [{ userId: AUTH_USER.id, role: 'editor' as const, user: AUTH_USER }],
        listTags: [],
      } as never,
    )
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([MOCK_LIST_ITEM]),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(200)
  })

  it('returns 403 when user is not a contributor of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(MOCK_LIST_ITEM as never)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, listUsers: [] } as never,
    )

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
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
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
