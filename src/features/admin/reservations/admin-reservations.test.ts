import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../../db/client.js'
import { apiRequest } from '../../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../../shared/test/auth.js'
import { ADMIN_USER_FIXTURE as ADMIN_USER, makeAdminUser } from '../../../shared/test/fixtures/users.js'
import { ItemStatuses } from '../../../shared/enums/item-status.js'
import { logger } from '../../../shared/utils/logger.js'

vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const NON_ADMIN_USER = makeAdminUser({
  id: '00000000-0000-0000-0000-000000000002',
  email: 'user@example.com',
  role: 'user',
})

const RESERVER_USER = makeAdminUser({
  id: '00000000-0000-0000-0000-000000000003',
  email: 'reserver@example.com',
  username: 'reserver',
  role: 'user',
})

const OWNER_USER = makeAdminUser({
  id: '00000000-0000-0000-0000-000000000004',
  email: 'owner@example.com',
  username: 'owner',
  role: 'user',
})

const LIST_ID = '00000000-0000-0000-0000-000000000010'
const ITEM_ID = '00000000-0000-0000-0000-000000000020'
const LIST_ITEM_ID = '00000000-0000-0000-0000-000000000030'
const RESERVATION_ID = '00000000-0000-0000-0000-000000000040'

const RESERVATION_ROW = {
  id: RESERVATION_ID,
  listItemId: LIST_ITEM_ID,
  userId: RESERVER_USER.id,
  quantityBooked: 2,
  createdAt: new Date('2024-02-01'),
  user: RESERVER_USER,
  listItem: {
    id: LIST_ITEM_ID,
    listId: LIST_ID,
    itemId: ITEM_ID,
    quantityDesired: 3,
    quantityReservedTotal: 2,
    itemStatus: ItemStatuses.AVAILABLE,
    sortOrder: null,
    creatorNote: null,
    imageId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    item: {
      id: ITEM_ID,
      name: 'Catalog Item',
      description: null,
      imageUrl: null,
      createdByUserId: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    image: null,
    list: {
      id: LIST_ID,
      occasionTypeId: null,
      title: 'Wishlist',
      slug: 'wishlist',
      description: null,
      listStatus: 'active',
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      collaborators: [
        {
          id: '00000000-0000-0000-0000-000000000050',
          listId: LIST_ID,
          userId: OWNER_USER.id,
          invitedEmail: null,
          collabRole: 'owner',
          inviteStatus: 'accepted',
          inviteToken: null,
          inviteTokenExpiresAt: null,
          acceptedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          user: OWNER_USER,
        },
      ],
    },
  },
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(ADMIN_USER.id)

function mockAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
}

function mockNonAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(
    makeAccessTokenEntry(NON_ADMIN_USER.id),
  )
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(NON_ADMIN_USER)
}

function mockListReservations(rows: unknown[]): void {
  vi.mocked(db.query.reservations.findMany).mockResolvedValueOnce(rows as never)
}

function mockCountReservationsChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockFindReservationFirst(row: unknown): void {
  vi.mocked(db.query.reservations.findFirst).mockResolvedValueOnce(row as never)
}

function mockResolveListItemIdsForList(listItemIds: string[]): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce(listItemIds.map((id) => ({ id }))),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

/**
 * Mocks the admin cancel transaction: SELECT ... FOR UPDATE on reservations,
 * SELECT ... FOR UPDATE on list_items, DELETE reservation, UPDATE list_items.
 */
interface MockAdminCancelOptions {
  reservation?: unknown
  listItem?: unknown
  deletedReservation?: unknown
}

function mockAdminCancelTransaction(options: MockAdminCancelOptions = {}): void {
  const reservation = 'reservation' in options ? options.reservation : RESERVATION_ROW
  const listItem = 'listItem' in options ? options.listItem : RESERVATION_ROW.listItem
  const deletedReservation =
    'deletedReservation' in options ? options.deletedReservation : reservation

  vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
    const selectReservationChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      for: vi.fn().mockResolvedValueOnce(reservation === null ? [] : [reservation]),
    }
    const selectListItemChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      for: vi.fn().mockResolvedValueOnce(listItem === null ? [] : [listItem]),
    }
    const select = vi
      .fn()
      .mockReturnValueOnce(selectReservationChain)
      .mockReturnValueOnce(selectListItemChain)

    const tx = {
      select,
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([listItem]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValueOnce(
            deletedReservation === null ? [] : [deletedReservation],
          ),
        }),
      }),
    }
    return callback(tx as never)
  })
}

describe('GET /v1/admin/reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 with a paginated AdminReservation list hydrating reserver + listItem + list + owner', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockListReservations([RESERVATION_ROW])
    mockCountReservationsChain(1)

    const response = await apiRequest('/v1/admin/reservations', { token })

    const body = await response.json() as {
      items: {
        id: string
        quantityBooked: number
        user: { id: string; email: string }
        listItem: { id: string; itemId: string; name: string; quantityDesired: number }
        list: { id: string; slug: string; title: string; owner: { id: string; email: string } | null }
      }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.pagination.total).toBe(1)
    expect(body.items[0]?.id).toBe(RESERVATION_ID)
    expect(body.items[0]?.quantityBooked).toBe(2)
    expect(body.items[0]?.user.id).toBe(RESERVER_USER.id)
    expect(body.items[0]?.listItem.itemId).toBe(ITEM_ID)
    expect(body.items[0]?.listItem.name).toBe('Catalog Item')
    expect(body.items[0]?.list.slug).toBe('wishlist')
    expect(body.items[0]?.list.owner?.id).toBe(OWNER_USER.id)
  })

  it('returns empty paginated response when no reservations match', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockListReservations([])
    mockCountReservationsChain(0)

    const response = await apiRequest('/v1/admin/reservations', { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it('accepts userId / listItemId filters and sort=quantityBooked:asc', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockListReservations([RESERVATION_ROW])
    mockCountReservationsChain(1)

    const response = await apiRequest(
      `/v1/admin/reservations?userId=${RESERVER_USER.id}&listItemId=${LIST_ITEM_ID}&sort=quantityBooked:asc`,
      { token },
    )

    expect(response.status).toBe(200)
  })

  it('resolves listId filter via list_items lookup and returns empty when the list has no list_items', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockResolveListItemIdsForList([])

    const response = await apiRequest(`/v1/admin/reservations?listId=${LIST_ID}`, { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it('resolves itemId filter via list_items lookup and returns matching reservations', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockResolveListItemIdsForList([LIST_ITEM_ID])
    mockListReservations([RESERVATION_ROW])
    mockCountReservationsChain(1)

    const response = await apiRequest(`/v1/admin/reservations?itemId=${ITEM_ID}`, { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('issues a single Drizzle query per page (no N+1 reloads for reserver / listItem / list / owner)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockListReservations([RESERVATION_ROW])
    mockCountReservationsChain(1)

    await apiRequest('/v1/admin/reservations', { token })

    expect(vi.mocked(db.query.reservations.findMany)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(db.query.users.findMany)).not.toHaveBeenCalled()
    expect(vi.mocked(db.query.listItems.findMany)).not.toHaveBeenCalled()
    expect(vi.mocked(db.query.lists.findMany)).not.toHaveBeenCalled()
  })

  it('returns 422 when sort field is not whitelisted', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/reservations?sort=unknown:asc', { token })
    expect(response.status).toBe(422)
  })

  it('returns 422 when userId filter is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/reservations?userId=not-a-uuid', { token })
    expect(response.status).toBe(422)
  })

  it('returns 403 when the caller is not an admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/reservations', { token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest('/v1/admin/reservations')
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/reservations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 with a fully hydrated AdminReservation', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindReservationFirst(RESERVATION_ROW)

    const response = await apiRequest(`/v1/admin/reservations/${RESERVATION_ID}`, { token })

    const body = await response.json() as {
      reservation: {
        id: string
        quantityBooked: number
        user: { id: string }
        listItem: { id: string; name: string }
        list: { owner: { id: string } | null }
      }
    }
    expect(response.status).toBe(200)
    expect(body.reservation.id).toBe(RESERVATION_ID)
    expect(body.reservation.user.id).toBe(RESERVER_USER.id)
    expect(body.reservation.listItem.name).toBe('Catalog Item')
    expect(body.reservation.list.owner?.id).toBe(OWNER_USER.id)
  })

  it('returns 404 when the reservation does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindReservationFirst(undefined)

    const response = await apiRequest(`/v1/admin/reservations/${RESERVATION_ID}`, { token })
    expect(response.status).toBe(404)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/reservations/not-a-uuid', { token })
    expect(response.status).toBe(422)
  })

  it('returns 403 when the caller is not an admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/reservations/${RESERVATION_ID}`, { token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/reservations/${RESERVATION_ID}`)
    expect(response.status).toBe(401)
  })
})

describe('DELETE /v1/admin/reservations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 204 and reconciles list_items.quantity_reserved_total via the shared primitive', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    const reservation = {
      id: RESERVATION_ID,
      listItemId: LIST_ITEM_ID,
      userId: RESERVER_USER.id,
      quantityBooked: 2,
      createdAt: new Date('2024-02-01'),
    }
    const listItem = {
      id: LIST_ITEM_ID,
      listId: LIST_ID,
      itemId: ITEM_ID,
      quantityDesired: 3,
      quantityReservedTotal: 2,
      itemStatus: ItemStatuses.AVAILABLE,
      sortOrder: null,
      creatorNote: null,
      imageId: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    }
    mockAdminCancelTransaction({ reservation, listItem, deletedReservation: reservation })

    const response = await apiRequest(`/v1/admin/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(204)
  })

  it('writes an admin_delete_reservation audit log with reservationId / listItemId / reserverUserId', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    const reservation = {
      id: RESERVATION_ID,
      listItemId: LIST_ITEM_ID,
      userId: RESERVER_USER.id,
      quantityBooked: 2,
      createdAt: new Date('2024-02-01'),
    }
    mockAdminCancelTransaction({
      reservation,
      listItem: RESERVATION_ROW.listItem,
      deletedReservation: reservation,
    })

    await apiRequest(`/v1/admin/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin_delete_reservation',
        adminId: ADMIN_USER.id,
        reservationId: RESERVATION_ID,
        listItemId: LIST_ITEM_ID,
        reserverUserId: RESERVER_USER.id,
      }),
    )
  })

  it('returns 404 and skips the audit log when the reservation does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockAdminCancelTransaction({ reservation: null })

    const response = await apiRequest(`/v1/admin/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(404)
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled()
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/reservations/not-a-uuid', {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when the caller is not an admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(401)
  })
})
