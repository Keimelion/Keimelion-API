import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'
import { ItemStatuses } from '../../shared/enums/item-status.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'

const AUTH_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'reserver@example.com',
  username: 'reserver',
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
}

const OWNER_USER_ID = '00000000-0000-0000-0000-000000000002'
const LIST_ID = '00000000-0000-0000-0000-000000000010'
const ITEM_ID = '00000000-0000-0000-0000-000000000020'
const LIST_ITEM_ID = '00000000-0000-0000-0000-000000000030'
const RESERVATION_ID = '00000000-0000-0000-0000-000000000040'

const MOCK_LIST = {
  id: LIST_ID,
  occasionTypeId: null,
  title: 'My Wishlist',
  slug: 'my-wishlist',
  description: null,
  listStatus: 'active' as const,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const OWNER_COLLABORATOR = {
  id: '00000000-0000-0000-0000-000000000050',
  listId: LIST_ID,
  userId: OWNER_USER_ID,
  invitedEmail: null,
  collabRole: 'owner' as const,
  inviteStatus: 'accepted',
  inviteToken: null,
  inviteTokenExpiresAt: null,
  acceptedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const MOCK_LIST_ITEM: ListItem = {
  id: LIST_ITEM_ID,
  listId: LIST_ID,
  itemId: ITEM_ID,
  quantityDesired: 3,
  quantityReservedTotal: 0,
  itemStatus: ItemStatuses.AVAILABLE,
  sortOrder: null,
  creatorNote: null,
  imageId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(AUTH_USER.id)

function mockAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)
}

function mockListItemLookup(listItem: typeof MOCK_LIST_ITEM = MOCK_LIST_ITEM): void {
  vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(listItem)
}

function mockListWithOwnerLookup(options: { deleted?: boolean; ownerUserId?: string } = {}): void {
  const list = {
    ...MOCK_LIST,
    deletedAt: options.deleted ? new Date('2024-01-02') : null,
    collaborators: [{ ...OWNER_COLLABORATOR, userId: options.ownerUserId ?? OWNER_USER_ID }],
    listTags: [],
  }
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(list)
}

/**
 * Mocks the SELECT ... FOR UPDATE chain used by the service inside the transaction.
 */
function mockSelectForUpdateListItem(listItem: typeof MOCK_LIST_ITEM = MOCK_LIST_ITEM): void {
  const forMock = vi.fn().mockResolvedValueOnce([listItem])
  const whereMock = vi.fn().mockReturnValueOnce({ for: forMock })
  const fromMock = vi.fn().mockReturnValueOnce({ where: whereMock })
  vi.mocked(db.select).mockReturnValueOnce({ from: fromMock } as never)
}

function mockSelectForUpdateReservation(reservation: unknown): void {
  const forMock = vi.fn().mockResolvedValueOnce([reservation])
  const whereMock = vi.fn().mockReturnValueOnce({ for: forMock })
  const fromMock = vi.fn().mockReturnValueOnce({ where: whereMock })
  vi.mocked(db.select).mockReturnValueOnce({ from: fromMock } as never)
}

function mockFindExistingReservation(reservation: unknown): void {
  vi.mocked(db.query.reservations.findFirst).mockResolvedValueOnce(reservation as never)
}

function mockUpsertReservation(reservation: unknown): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      onConflictDoUpdate: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([reservation]),
      }),
    }),
  } as never)
}

function mockUpdateListItemState(listItem: unknown): void {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([listItem]),
      }),
    }),
  } as never)
}

function mockDeleteReservation(reservation: unknown): void {
  vi.mocked(db.delete).mockReturnValueOnce({
    where: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([reservation]),
    }),
  } as never)
}

describe('POST /v1/list-items/:id/reserve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 when a new reservation is created and marks item reserved when full', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockListItemLookup()
    mockListWithOwnerLookup()
    mockSelectForUpdateListItem()
    mockFindExistingReservation(undefined)
    const insertedReservation = {
      id: RESERVATION_ID,
      listItemId: LIST_ITEM_ID,
      userId: AUTH_USER.id,
      quantityBooked: 3,
      createdAt: new Date('2024-02-01'),
    }
    mockUpsertReservation(insertedReservation)
    const updatedListItem = { ...MOCK_LIST_ITEM, quantityReservedTotal: 3, itemStatus: ItemStatuses.RESERVED }
    mockUpdateListItemState(updatedListItem)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}/reserve`, {
      method: 'POST',
      token,
      body: { quantityBooked: 3 },
    })

    const body = await response.json() as {
      reservation: { id: string; quantityBooked: number }
      listItem: { quantityReservedTotal: number; itemStatus: string }
    }
    expect(response.status).toBe(201)
    expect(body.reservation.id).toBe(RESERVATION_ID)
    expect(body.reservation.quantityBooked).toBe(3)
    expect(body.listItem.quantityReservedTotal).toBe(3)
    expect(body.listItem.itemStatus).toBe(ItemStatuses.RESERVED)
  })

  it('returns 200 and leaves status available when the upsert updates an existing reservation and total is below desired', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockListItemLookup({ ...MOCK_LIST_ITEM, quantityReservedTotal: 2 })
    mockListWithOwnerLookup()
    mockSelectForUpdateListItem({ ...MOCK_LIST_ITEM, quantityReservedTotal: 2 })
    const existingReservation = {
      id: RESERVATION_ID,
      listItemId: LIST_ITEM_ID,
      userId: AUTH_USER.id,
      quantityBooked: 2,
      createdAt: new Date('2024-01-05'),
    }
    mockFindExistingReservation(existingReservation)
    const updatedReservation = { ...existingReservation, quantityBooked: 1 }
    mockUpsertReservation(updatedReservation)
    const updatedListItem = { ...MOCK_LIST_ITEM, quantityReservedTotal: 1, itemStatus: ItemStatuses.AVAILABLE }
    mockUpdateListItemState(updatedListItem)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}/reserve`, {
      method: 'POST',
      token,
      body: { quantityBooked: 1 },
    })

    const body = await response.json() as {
      reservation: { quantityBooked: number }
      listItem: { quantityReservedTotal: number; itemStatus: string }
    }
    expect(response.status).toBe(200)
    expect(body.reservation.quantityBooked).toBe(1)
    expect(body.listItem.quantityReservedTotal).toBe(1)
    expect(body.listItem.itemStatus).toBe(ItemStatuses.AVAILABLE)
  })

  it('returns 403 when the caller is the list owner', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockListItemLookup()
    mockListWithOwnerLookup({ ownerUserId: AUTH_USER.id })

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}/reserve`, {
      method: 'POST',
      token,
      body: { quantityBooked: 1 },
    })

    expect(response.status).toBe(403)
  })

  it('returns 404 when the list is soft-deleted', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockListItemLookup()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce({
      ...MOCK_LIST,
      deletedAt: new Date('2024-01-05'),
      collaborators: [OWNER_COLLABORATOR],
      listTags: [],
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}/reserve`, {
      method: 'POST',
      token,
      body: { quantityBooked: 1 },
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 when the list item does not exist', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}/reserve`, {
      method: 'POST',
      token,
      body: { quantityBooked: 1 },
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when quantityBooked exceeds quantityDesired', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockListItemLookup()
    mockListWithOwnerLookup()

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}/reserve`, {
      method: 'POST',
      token,
      body: { quantityBooked: 10 },
    })

    const body = await response.json() as { code: string; metadata: { issues: { path: string }[] } }
    expect(response.status).toBe(422)
    expect(body.code).toBe('UNPROCESSABLE_ENTITY')
    expect(body.metadata.issues[0]?.path).toBe('quantityBooked')
  })

  it('returns 409 when adding this reservation would exceed the remaining capacity', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    const listItemAtTwo = { ...MOCK_LIST_ITEM, quantityReservedTotal: 2 }
    mockListItemLookup(listItemAtTwo)
    mockListWithOwnerLookup()
    mockSelectForUpdateListItem(listItemAtTwo)
    mockFindExistingReservation(undefined) // no existing — delta == new quantity

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}/reserve`, {
      method: 'POST',
      token,
      body: { quantityBooked: 2 },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}/reserve`, {
      method: 'POST',
      body: { quantityBooked: 1 },
    })

    expect(response.status).toBe(401)
  })

  it('returns 422 when quantityBooked is less than 1', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}/reserve`, {
      method: 'POST',
      token,
      body: { quantityBooked: 0 },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when the id param is not a UUID', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()

    const response = await apiRequest('/v1/list-items/not-a-uuid/reserve', {
      method: 'POST',
      token,
      body: { quantityBooked: 1 },
    })

    expect(response.status).toBe(422)
  })
})

describe('DELETE /v1/reservations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 204 and flips item back to available when the caller cancels their own reservation', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    const reservation = {
      id: RESERVATION_ID,
      listItemId: LIST_ITEM_ID,
      userId: AUTH_USER.id,
      quantityBooked: 3,
      createdAt: new Date('2024-01-05'),
    }
    const fullListItem = { ...MOCK_LIST_ITEM, quantityReservedTotal: 3, itemStatus: ItemStatuses.RESERVED }
    mockSelectForUpdateReservation(reservation)
    mockSelectForUpdateListItem(fullListItem)
    mockDeleteReservation(reservation)
    const setMock = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{ ...fullListItem, quantityReservedTotal: 0, itemStatus: ItemStatuses.AVAILABLE }]),
      }),
    })
    vi.mocked(db.update).mockReturnValueOnce({ set: setMock } as never)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(204)
    expect(setMock).toHaveBeenCalledOnce()
    const setArgs = setMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArgs.quantityReservedTotal).toBe(0)
    expect(setArgs.itemStatus).toBe(ItemStatuses.AVAILABLE)
  })

  it('returns 404 when the reservation id does not exist', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockSelectForUpdateReservation(undefined)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('returns 403 when the reservation belongs to another user', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    const otherUserReservation = {
      id: RESERVATION_ID,
      listItemId: LIST_ITEM_ID,
      userId: '00000000-0000-0000-0000-00000000aaaa',
      quantityBooked: 1,
      createdAt: new Date('2024-01-05'),
    }
    mockSelectForUpdateReservation(otherUserReservation)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(401)
  })

  it('returns 422 when the id param is not a UUID', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()

    const response = await apiRequest('/v1/reservations/not-a-uuid', {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })
})
