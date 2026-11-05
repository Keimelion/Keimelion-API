import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'
import { ItemStatuses } from '../../shared/enums/item-status.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { hashSha256Hex } from '../../shared/utils/hash.js'
import { logger } from '../../shared/utils/logger.js'
import { makeAdminUser } from '../../shared/test/fixtures/users.js'
import { toReservationDetail } from '../../shared/types/reservation.js'
import { toReservationSummary } from './reservations.types.js'
import {
  extractReservationToken,
  generateReservationToken,
  isReservationTokenMatch,
} from './reservations.token.js'
import { RESERVER_NAME_MAX_LENGTH } from '../../db/entities/reservations/reservations.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { Reservation } from '../../db/entities/reservations/reservations.schema.js'

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const AUTH_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'reserver@example.com',
  username: 'reserver',
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

const OWNER_USER_ID = '00000000-0000-0000-0000-000000000002'
const LIST_ID = '00000000-0000-0000-0000-000000000010'
const ITEM_ID = '00000000-0000-0000-0000-000000000020'
const LIST_ITEM_ID = '00000000-0000-0000-0000-000000000030'
const RESERVATION_ID = '00000000-0000-0000-0000-000000000040'
const OTHER_USER_ID = '00000000-0000-0000-0000-00000000aaaa'
const RESERVATION_TOKEN_REGEX = /^rsv_[A-Za-z0-9_-]{43}$/
const ANONYMOUS_TOKEN = 'rsv_testAnonymousReservationToken00000000000000'
const ANONYMOUS_TOKEN_HASH = hashSha256Hex(ANONYMOUS_TOKEN)

const OWNER_USER = makeAdminUser({ id: OWNER_USER_ID, email: 'owner@example.com', username: 'owner', role: 'user' })

const SELF_RESERVATION: Reservation = {
  id: RESERVATION_ID,
  listItemId: LIST_ITEM_ID,
  userId: AUTH_USER.id,
  reserverName: null,
  reserverEmail: null,
  anonymousTokenHash: null,
  quantityBooked: 1,
  createdAt: new Date('2024-02-01'),
}

const ANONYMOUS_RESERVATION: Reservation = {
  ...SELF_RESERVATION,
  userId: null,
  reserverName: 'Aunt Marie',
  reserverEmail: 'aunt.marie@example.com',
  anonymousTokenHash: ANONYMOUS_TOKEN_HASH,
}

const PROXY_RESERVATION: Reservation = {
  ...SELF_RESERVATION,
  userId: null,
  reserverName: 'Grandpa Joe',
  reserverEmail: 'grandpa@example.com',
}

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
  role: 'owner' as const,
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

function mockListWithOwnerLookup(
  options: { deleted?: boolean; ownerUserId?: string; editorUserId?: string } = {},
): void {
  const owner = { ...OWNER_COLLABORATOR, userId: options.ownerUserId ?? OWNER_USER_ID }
  const editor = options.editorUserId === undefined
    ? []
    : [{ ...OWNER_COLLABORATOR, role: 'editor' as const, userId: options.editorUserId }]
  const list = {
    ...MOCK_LIST,
    deletedAt: options.deleted ? new Date('2024-01-02') : null,
    listUsers: [owner, ...editor],
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


function mockInsertNamedReservation(reservation: unknown): ReturnType<typeof vi.fn> {
  const valuesMock = vi.fn().mockReturnValueOnce({
    returning: vi.fn().mockResolvedValueOnce([reservation]),
  })
  vi.mocked(db.insert).mockReturnValueOnce({ values: valuesMock } as never)
  return valuesMock
}

function mockOwnerLookup(ownerUserId: string = OWNER_USER_ID): void {
  vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce({
    id: LIST_ITEM_ID,
    list: { id: LIST_ID, listUsers: [{ userId: ownerUserId }] },
  } as never)
}

function mockHydratedReservation(reservation: Reservation): void {
  vi.mocked(db.query.reservations.findFirst).mockResolvedValueOnce({
    ...reservation,
    listItem: {
      ...MOCK_LIST_ITEM,
      item: {
        id: ITEM_ID,
        name: 'Catalog Item',
        description: null,
        imageId: null,
        image: null,
        createdByUserId: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      list: {
        ...MOCK_LIST,
        listUsers: [{ ...OWNER_COLLABORATOR, user: { ...OWNER_USER, avatarImage: null } }],
      },
    },
  } as never)
}

function mockCancelTransaction(reservation: Reservation, ownerUserId: string = OWNER_USER_ID): void {
  mockSelectForUpdateReservation(reservation)
  mockOwnerLookup(ownerUserId)
  mockSelectForUpdateListItem({ ...MOCK_LIST_ITEM, quantityReservedTotal: reservation.quantityBooked })
  mockDeleteReservation(reservation)
  mockUpdateListItemState({ ...MOCK_LIST_ITEM, quantityReservedTotal: 0 })
}

function expectLoggedEvent(event: string): void {
  expect(vi.mocked(logger.info)).toHaveBeenCalledWith(expect.objectContaining({ event }))
}

function expectNotLoggedEvent(event: string): void {
  expect(vi.mocked(logger.info)).not.toHaveBeenCalledWith(expect.objectContaining({ event }))
}

interface ReservationActionBody {
  reservation: {
    id: string
    userId: string | null
    reserverName: string | null
    reserverEmail: string | null
    quantityBooked: number
  }
  listItem: { quantityReservedTotal: number; itemStatus: string }
  token?: string
}

interface ApiErrorBody {
  code: string
  metadata: { issues?: { path: string }[] }
}

async function postReservation(body: Record<string, unknown>, token?: string): Promise<Response> {
  if (token === undefined) return apiRequest('/v1/reservations', { method: 'POST', body })
  return apiRequest('/v1/reservations', { method: 'POST', token, body })
}

describe('POST /v1/reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authenticated self reservation', () => {
    it('returns 201 when a new reservation is created and marks item reserved when full', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()
      mockListItemLookup()
      mockListWithOwnerLookup()
      mockSelectForUpdateListItem()
      mockFindExistingReservation(undefined)
      mockUpsertReservation({ ...SELF_RESERVATION, quantityBooked: 3 })
      mockUpdateListItemState({ ...MOCK_LIST_ITEM, quantityReservedTotal: 3, itemStatus: ItemStatuses.RESERVED })

      const response = await postReservation({ listItemId: LIST_ITEM_ID, quantityBooked: 3 }, token)

      const body = await response.json() as ReservationActionBody
      expect(response.status).toBe(201)
      expect(body.reservation.id).toBe(RESERVATION_ID)
      expect(body.reservation.userId).toBe(AUTH_USER.id)
      expect(body.reservation.quantityBooked).toBe(3)
      expect(body.listItem.quantityReservedTotal).toBe(3)
      expect(body.listItem.itemStatus).toBe(ItemStatuses.RESERVED)
      expect(body).not.toHaveProperty('token')
    })

    it('returns 200 and leaves status available when the upsert updates an existing reservation', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()
      mockListItemLookup({ ...MOCK_LIST_ITEM, quantityReservedTotal: 2 })
      mockListWithOwnerLookup()
      mockSelectForUpdateListItem({ ...MOCK_LIST_ITEM, quantityReservedTotal: 2 })
      mockFindExistingReservation({ ...SELF_RESERVATION, quantityBooked: 2 })
      mockUpsertReservation({ ...SELF_RESERVATION, quantityBooked: 1 })
      mockUpdateListItemState({ ...MOCK_LIST_ITEM, quantityReservedTotal: 1 })

      const response = await postReservation({ listItemId: LIST_ITEM_ID, quantityBooked: 1 }, token)

      const body = await response.json() as ReservationActionBody
      expect(response.status).toBe(200)
      expect(body.reservation.quantityBooked).toBe(1)
      expect(body.listItem.quantityReservedTotal).toBe(1)
      expect(body.listItem.itemStatus).toBe(ItemStatuses.AVAILABLE)
    })

    it('returns 201 when the caller is the list owner (owner self-reserve is allowed)', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()
      mockListItemLookup()
      mockListWithOwnerLookup({ ownerUserId: AUTH_USER.id })
      mockSelectForUpdateListItem()
      mockFindExistingReservation(undefined)
      mockUpsertReservation(SELF_RESERVATION)
      mockUpdateListItemState({ ...MOCK_LIST_ITEM, quantityReservedTotal: 1 })

      const response = await postReservation({ listItemId: LIST_ITEM_ID, quantityBooked: 1 }, token)

      const body = await response.json() as ReservationActionBody
      expect(response.status).toBe(201)
      expect(body.reservation.userId).toBe(AUTH_USER.id)
      expect(body).not.toHaveProperty('token')
    })

    it('returns 201 when the caller is an editor of the list', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()
      mockListItemLookup()
      mockListWithOwnerLookup({ editorUserId: AUTH_USER.id })
      mockSelectForUpdateListItem()
      mockFindExistingReservation(undefined)
      mockUpsertReservation(SELF_RESERVATION)
      mockUpdateListItemState({ ...MOCK_LIST_ITEM, quantityReservedTotal: 1 })

      const response = await postReservation({ listItemId: LIST_ITEM_ID, quantityBooked: 1 }, token)

      expect(response.status).toBe(201)
    })

    it('returns 409 when adding this reservation would exceed the remaining capacity', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()
      const listItemAtTwo = { ...MOCK_LIST_ITEM, quantityReservedTotal: 2 }
      mockListItemLookup(listItemAtTwo)
      mockListWithOwnerLookup()
      mockSelectForUpdateListItem(listItemAtTwo)
      mockFindExistingReservation(undefined)

      const response = await postReservation({ listItemId: LIST_ITEM_ID, quantityBooked: 2 }, token)

      const body = await response.json() as ApiErrorBody
      expect(response.status).toBe(409)
      expect(body.code).toBe(ErrorCode.CONFLICT)
    })

    it('returns 422 RESERVATION_INCONSISTENT_INTENT when a non-owner passes reserverName', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()
      mockListItemLookup()
      mockListWithOwnerLookup()

      const response = await postReservation(
        { listItemId: LIST_ITEM_ID, quantityBooked: 1, reserverName: 'Someone' },
        token,
      )

      const body = await response.json() as ApiErrorBody
      expect(response.status).toBe(422)
      expect(body.code).toBe(ErrorCode.RESERVATION_INCONSISTENT_INTENT)
    })

    it('returns 422 RESERVATION_INCONSISTENT_INTENT when an editor passes reserverName', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()
      mockListItemLookup()
      mockListWithOwnerLookup({ editorUserId: AUTH_USER.id })

      const response = await postReservation(
        { listItemId: LIST_ITEM_ID, quantityBooked: 1, reserverName: 'Someone' },
        token,
      )

      const body = await response.json() as ApiErrorBody
      expect(response.status).toBe(422)
      expect(body.code).toBe(ErrorCode.RESERVATION_INCONSISTENT_INTENT)
    })
  })

  describe('owner proxy reservation', () => {
    it('returns 201 without a token, stores reserver identity and emits an audit log', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()
      mockListItemLookup()
      mockListWithOwnerLookup({ ownerUserId: AUTH_USER.id })
      mockSelectForUpdateListItem()
      mockFindExistingReservation(undefined)
      const valuesMock = mockInsertNamedReservation(PROXY_RESERVATION)
      mockUpdateListItemState({ ...MOCK_LIST_ITEM, quantityReservedTotal: 1 })

      const response = await postReservation(
        {
          listItemId: LIST_ITEM_ID,
          quantityBooked: 1,
          reserverName: '  Grandpa Joe  ',
          reserverEmail: 'Grandpa@Example.com',
        },
        token,
      )

      const body = await response.json() as ReservationActionBody
      expect(response.status).toBe(201)
      expect(body).not.toHaveProperty('token')
      expect(body.reservation.userId).toBeNull()
      expect(body.reservation.reserverName).toBe('Grandpa Joe')
      expect(valuesMock).toHaveBeenCalledWith({
        listItemId: LIST_ITEM_ID,
        quantityBooked: 1,
        reserverName: 'Grandpa Joe',
        reserverEmail: 'grandpa@example.com',
        anonymousTokenHash: null,
      })
      expectLoggedEvent('owner_proxy_create_reservation')
    })

    it('returns 409 when a reservation with the same normalised name or email already exists', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()
      mockListItemLookup()
      mockListWithOwnerLookup({ ownerUserId: AUTH_USER.id })
      mockSelectForUpdateListItem()
      mockFindExistingReservation(ANONYMOUS_RESERVATION)

      const response = await postReservation(
        { listItemId: LIST_ITEM_ID, quantityBooked: 1, reserverName: 'aunt marie' },
        token,
      )

      const body = await response.json() as ApiErrorBody
      expect(response.status).toBe(409)
      expect(body.code).toBe(ErrorCode.CONFLICT)
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    })
  })

  describe('anonymous reservation', () => {
    it('returns 201 with a one-time rsv_ token whose sha256 is the stored hash', async () => {
      mockListItemLookup()
      mockListWithOwnerLookup()
      mockSelectForUpdateListItem()
      mockFindExistingReservation(undefined)
      const valuesMock = mockInsertNamedReservation(ANONYMOUS_RESERVATION)
      mockUpdateListItemState({ ...MOCK_LIST_ITEM, quantityReservedTotal: 1 })

      const response = await postReservation({
        listItemId: LIST_ITEM_ID,
        quantityBooked: 1,
        reserverName: 'Aunt Marie',
        reserverEmail: 'AUNT.MARIE@example.com',
      })

      const body = await response.json() as ReservationActionBody
      expect(response.status).toBe(201)
      expect(body.token).toMatch(RESERVATION_TOKEN_REGEX)
      expect(body.reservation.userId).toBeNull()
      expect(body.reservation).not.toHaveProperty('anonymousTokenHash')
      const insertedValues = valuesMock.mock.calls[0]?.[0] as Record<string, unknown>
      expect(insertedValues.anonymousTokenHash).toBe(hashSha256Hex(body.token ?? ''))
      expect(insertedValues.reserverEmail).toBe('aunt.marie@example.com')
      expect(insertedValues.reserverName).toBe('Aunt Marie')
    })

    it('returns 422 RESERVATION_REQUIRES_RESERVER_NAME when reserverName is missing', async () => {
      mockListItemLookup()
      mockListWithOwnerLookup()

      const response = await postReservation({ listItemId: LIST_ITEM_ID, quantityBooked: 1 })

      const body = await response.json() as ApiErrorBody
      expect(response.status).toBe(422)
      expect(body.code).toBe(ErrorCode.RESERVATION_REQUIRES_RESERVER_NAME)
    })

    it('treats an explicit null reserverName as absent', async () => {
      mockListItemLookup()
      mockListWithOwnerLookup()

      const response = await postReservation({
        listItemId: LIST_ITEM_ID,
        quantityBooked: 1,
        reserverName: null,
        reserverEmail: null,
      })

      const body = await response.json() as ApiErrorBody
      expect(response.status).toBe(422)
      expect(body.code).toBe(ErrorCode.RESERVATION_REQUIRES_RESERVER_NAME)
    })

    it('returns 409 when a reservation with the same normalised name or email already exists', async () => {
      mockListItemLookup()
      mockListWithOwnerLookup()
      mockSelectForUpdateListItem()
      mockFindExistingReservation(ANONYMOUS_RESERVATION)

      const response = await postReservation({
        listItemId: LIST_ITEM_ID,
        quantityBooked: 1,
        reserverName: 'aunt marie',
      })

      const body = await response.json() as ApiErrorBody
      expect(response.status).toBe(409)
      expect(body.code).toBe(ErrorCode.CONFLICT)
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    })

    it('returns 409 when the anonymous reservation would overbook the item', async () => {
      const fullListItem = { ...MOCK_LIST_ITEM, quantityReservedTotal: 3 }
      mockListItemLookup(fullListItem)
      mockListWithOwnerLookup()
      mockSelectForUpdateListItem(fullListItem)
      mockFindExistingReservation(undefined)

      const response = await postReservation({
        listItemId: LIST_ITEM_ID,
        quantityBooked: 1,
        reserverName: 'Aunt Marie',
      })

      const body = await response.json() as ApiErrorBody
      expect(response.status).toBe(409)
      expect(body.code).toBe(ErrorCode.CONFLICT)
    })

    it('returns 404 when the list is soft-deleted', async () => {
      mockListItemLookup()
      mockListWithOwnerLookup({ deleted: true })

      const response = await postReservation({
        listItemId: LIST_ITEM_ID,
        quantityBooked: 1,
        reserverName: 'Aunt Marie',
      })

      expect(response.status).toBe(404)
    })

    it('returns 404 when the list item does not exist', async () => {
      vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(undefined)

      const response = await postReservation({
        listItemId: LIST_ITEM_ID,
        quantityBooked: 1,
        reserverName: 'Aunt Marie',
      })

      expect(response.status).toBe(404)
    })
  })

  describe('validation', () => {
    it('returns 422 when quantityBooked exceeds quantityDesired', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()
      mockListItemLookup()
      mockListWithOwnerLookup()

      const response = await postReservation({ listItemId: LIST_ITEM_ID, quantityBooked: 10 }, token)

      const body = await response.json() as ApiErrorBody
      expect(response.status).toBe(422)
      expect(body.code).toBe(ErrorCode.UNPROCESSABLE_ENTITY)
      expect(body.metadata.issues?.[0]?.path).toBe('quantityBooked')
    })

    it.each([
      ['quantityBooked below 1', { listItemId: LIST_ITEM_ID, quantityBooked: 0, reserverName: 'A' }],
      ['listItemId not a UUID', { listItemId: 'not-a-uuid', quantityBooked: 1, reserverName: 'A' }],
      ['blank reserverName', { listItemId: LIST_ITEM_ID, quantityBooked: 1, reserverName: '   ' }],
      [
        'reserverName too long',
        { listItemId: LIST_ITEM_ID, quantityBooked: 1, reserverName: 'a'.repeat(RESERVER_NAME_MAX_LENGTH + 1) },
      ],
      ['invalid reserverEmail', { listItemId: LIST_ITEM_ID, quantityBooked: 1, reserverName: 'A', reserverEmail: 'nope' }],
      ['reserverEmail without reserverName', { listItemId: LIST_ITEM_ID, quantityBooked: 1, reserverEmail: 'a@b.co' }],
      ['unknown field', { listItemId: LIST_ITEM_ID, quantityBooked: 1, reserverName: 'A', extra: true }],
    ])('returns 422 when %s', async (_label, body) => {
      const response = await postReservation(body)

      const errorBody = await response.json() as ApiErrorBody
      expect(response.status).toBe(422)
      expect(errorBody.code).toBe(ErrorCode.UNPROCESSABLE_ENTITY)
    })

    it('no longer exposes the legacy POST /v1/list-items/:id/reserve route', async () => {
      const token = await generateTestToken(AUTH_USER.id)
      mockAuth()

      const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}/reserve`, {
        method: 'POST',
        token,
        body: { quantityBooked: 1 },
      })

      expect(response.status).toBe(404)
    })
  })
})

describe('GET /v1/reservations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 to the authenticated reserver', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockHydratedReservation(SELF_RESERVATION)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { token })

    const body = await response.json() as { reservation: { id: string; list: { owner: { id: string } } } }
    expect(response.status).toBe(200)
    expect(body.reservation.id).toBe(RESERVATION_ID)
    expect(body.reservation.list.owner.id).toBe(OWNER_USER_ID)
  })

  it('returns 200 with reserverEmail to the list owner on a proxy reservation', async () => {
    const token = await generateTestToken(OWNER_USER_ID)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(makeAccessTokenEntry(OWNER_USER_ID))
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(OWNER_USER)
    mockHydratedReservation(PROXY_RESERVATION)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { token })

    const body = await response.json() as { reservation: { reserverName: string; reserverEmail: string } }
    expect(response.status).toBe(200)
    expect(body.reservation.reserverName).toBe('Grandpa Joe')
    expect(body.reservation.reserverEmail).toBe('grandpa@example.com')
  })

  it('returns 200 to the anonymous holder of a valid bearer token and never echoes the token or hash', async () => {
    mockHydratedReservation(ANONYMOUS_RESERVATION)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { token: ANONYMOUS_TOKEN })

    const rawBody = await response.text()
    expect(response.status).toBe(200)
    expect(rawBody).toContain('aunt.marie@example.com')
    expect(rawBody).not.toContain(ANONYMOUS_TOKEN)
    expect(rawBody).not.toContain(ANONYMOUS_TOKEN_HASH)
    expect(rawBody).not.toContain('anonymousTokenHash')
    expect(rawBody).not.toContain('"token"')
  })

  it('returns 403 RESERVATION_TOKEN_INVALID on bearer mismatch', async () => {
    mockHydratedReservation(ANONYMOUS_RESERVATION)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, {
      token: 'rsv_wrongTokenWrongTokenWrongTokenWrongToken0',
    })

    const body = await response.json() as ApiErrorBody
    expect(response.status).toBe(403)
    expect(body.code).toBe(ErrorCode.RESERVATION_TOKEN_INVALID)
  })

  it('returns 403 RESERVATION_TOKEN_INVALID when a bearer token targets a non-anonymous reservation', async () => {
    mockHydratedReservation(SELF_RESERVATION)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { token: ANONYMOUS_TOKEN })

    const body = await response.json() as ApiErrorBody
    expect(response.status).toBe(403)
    expect(body.code).toBe(ErrorCode.RESERVATION_TOKEN_INVALID)
  })

  it('returns 403 FORBIDDEN to an authenticated stranger', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockHydratedReservation({ ...SELF_RESERVATION, userId: OTHER_USER_ID })

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { token })

    const body = await response.json() as ApiErrorBody
    expect(response.status).toBe(403)
    expect(body.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('returns 403 FORBIDDEN to an anonymous caller without a token', async () => {
    mockHydratedReservation(ANONYMOUS_RESERVATION)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`)

    const body = await response.json() as ApiErrorBody
    expect(response.status).toBe(403)
    expect(body.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('returns 404 when the reservation does not exist', async () => {
    vi.mocked(db.query.reservations.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { token: ANONYMOUS_TOKEN })

    expect(response.status).toBe(404)
  })

  it('returns 422 when the id param is not a UUID', async () => {
    const response = await apiRequest('/v1/reservations/not-a-uuid')

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
    const reservation = { ...SELF_RESERVATION, quantityBooked: 3 }
    const fullListItem = { ...MOCK_LIST_ITEM, quantityReservedTotal: 3, itemStatus: ItemStatuses.RESERVED }
    mockSelectForUpdateReservation(reservation)
    mockOwnerLookup()
    mockSelectForUpdateListItem(fullListItem)
    mockDeleteReservation(reservation)
    const setMock = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{ ...fullListItem, quantityReservedTotal: 0, itemStatus: ItemStatuses.AVAILABLE }]),
      }),
    })
    vi.mocked(db.update).mockReturnValueOnce({ set: setMock } as never)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { method: 'DELETE', token })

    expect(response.status).toBe(204)
    const setArgs = setMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArgs.quantityReservedTotal).toBe(0)
    expect(setArgs.itemStatus).toBe(ItemStatuses.AVAILABLE)
    expectNotLoggedEvent('owner_cancel_reservation')
  })

  it('returns 204 and emits an audit log when the list owner cancels a third-party reservation', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockCancelTransaction({ ...ANONYMOUS_RESERVATION }, AUTH_USER.id)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { method: 'DELETE', token })

    expect(response.status).toBe(204)
    expectLoggedEvent('owner_cancel_reservation')
  })

  it('does not emit the owner audit log when the owner cancels their own reservation', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockCancelTransaction(SELF_RESERVATION, AUTH_USER.id)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { method: 'DELETE', token })

    expect(response.status).toBe(204)
    expectNotLoggedEvent('owner_cancel_reservation')
  })

  it('returns 204 to the anonymous holder of a valid bearer token', async () => {
    mockCancelTransaction(ANONYMOUS_RESERVATION)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
      token: ANONYMOUS_TOKEN,
    })

    expect(response.status).toBe(204)
    expectNotLoggedEvent('owner_cancel_reservation')
  })

  it('returns 403 RESERVATION_TOKEN_INVALID on bearer mismatch and does not delete', async () => {
    mockSelectForUpdateReservation(ANONYMOUS_RESERVATION)
    mockOwnerLookup()

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, {
      method: 'DELETE',
      token: 'rsv_wrongTokenWrongTokenWrongTokenWrongToken0',
    })

    const body = await response.json() as ApiErrorBody
    expect(response.status).toBe(403)
    expect(body.code).toBe(ErrorCode.RESERVATION_TOKEN_INVALID)
    expect(vi.mocked(db.delete)).not.toHaveBeenCalled()
  })

  it('returns 403 when the reservation belongs to another user', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockSelectForUpdateReservation({ ...SELF_RESERVATION, userId: OTHER_USER_ID })
    mockOwnerLookup()

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { method: 'DELETE', token })

    const body = await response.json() as ApiErrorBody
    expect(response.status).toBe(403)
    expect(body.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('returns 403 to an anonymous caller without a token', async () => {
    mockSelectForUpdateReservation(ANONYMOUS_RESERVATION)
    mockOwnerLookup()

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { method: 'DELETE' })

    expect(response.status).toBe(403)
  })

  it('returns 404 when the reservation does not exist or was already cancelled', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuth()
    mockSelectForUpdateReservation(undefined)

    const response = await apiRequest(`/v1/reservations/${RESERVATION_ID}`, { method: 'DELETE', token })

    expect(response.status).toBe(404)
  })

  it('returns 422 when the id param is not a UUID', async () => {
    const response = await apiRequest('/v1/reservations/not-a-uuid', { method: 'DELETE' })

    expect(response.status).toBe(422)
  })
})

describe('reservation token', () => {
  it('generates a fresh rsv_ token per call with a matching sha256 hash', () => {
    const first = generateReservationToken()
    const second = generateReservationToken()

    expect(first.rawToken).toMatch(RESERVATION_TOKEN_REGEX)
    expect(second.rawToken).toMatch(RESERVATION_TOKEN_REGEX)
    expect(first.rawToken).not.toBe(second.rawToken)
    expect(first.tokenHash).toBe(hashSha256Hex(first.rawToken))
  })

  it('matches only the token whose hash is stored', () => {
    expect(isReservationTokenMatch(ANONYMOUS_TOKEN, ANONYMOUS_TOKEN_HASH)).toBe(true)
    expect(isReservationTokenMatch(`${ANONYMOUS_TOKEN}x`, ANONYMOUS_TOKEN_HASH)).toBe(false)
  })

  it('rejects a malformed stored hash without throwing', () => {
    expect(isReservationTokenMatch(ANONYMOUS_TOKEN, 'not-hex')).toBe(false)
  })

  it('extracts only rsv_ bearer tokens from the Authorization header', () => {
    expect(extractReservationToken(`Bearer ${ANONYMOUS_TOKEN}`)).toBe(ANONYMOUS_TOKEN)
    expect(extractReservationToken('Bearer eyJhbGciOi.jwt.value')).toBeNull()
    expect(extractReservationToken(undefined)).toBeNull()
  })
})

describe('reservation mappers', () => {
  it('never serialises anonymousTokenHash in the action summary', () => {
    const summary = toReservationSummary(ANONYMOUS_RESERVATION)

    expect(summary).not.toHaveProperty('anonymousTokenHash')
    expect(JSON.stringify(summary)).not.toContain(ANONYMOUS_TOKEN_HASH)
  })

  it('never serialises anonymousTokenHash in the reservation detail', () => {
    const detail = toReservationDetail({
      ...ANONYMOUS_RESERVATION,
      listItem: {
        ...MOCK_LIST_ITEM,
        item: {
          id: ITEM_ID,
          name: 'Catalog Item',
          description: null,
          imageId: null,
          image: null,
          createdByUserId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        list: { ...MOCK_LIST, listUsers: [] },
      },
    })

    expect(detail).not.toHaveProperty('anonymousTokenHash')
    expect(JSON.stringify(detail)).not.toContain(ANONYMOUS_TOKEN_HASH)
  })
})
