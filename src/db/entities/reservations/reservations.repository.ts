import { and, count, desc, eq, inArray, or, sql } from 'drizzle-orm'
import type { AnyColumn } from 'drizzle-orm'
import type { RESERVATION_SORT_FIELDS } from '@keimelion/sdk/schemas'
import { db } from '../../client.js'
import { defineEntity } from '../../../shared/db/entity-descriptor.js'
import { getOffset } from '../../../shared/utils/pagination.js'
import { ListUserRoles } from '@keimelion/sdk/enums'
import type { PaginationQueryParsed, SortInput } from '@keimelion/sdk/schemas'
import { listItems } from '../list-items/list-items.schema.js'
import { listUsers } from '../list-users/list-users.schema.js'
import { reservations } from './reservations.schema.js'
import type { Reservation } from './reservations.schema.js'
import type { ReservationRowHydrated } from '../../../shared/types/reservation.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbOrTx = typeof db | DbTransaction

export const RESERVATION_SORTABLE_FIELDS = {
  createdAt: reservations.createdAt,
  quantityBooked: reservations.quantityBooked,
} as const satisfies Record<(typeof RESERVATION_SORT_FIELDS)[number], AnyColumn>

export const RESERVATION_DEFAULT_SORT = [{ field: 'createdAt' as const, direction: 'desc' as const }]

export const userReservationsEntity = defineEntity({
  sortable: RESERVATION_SORTABLE_FIELDS,
  defaultSort: RESERVATION_DEFAULT_SORT,
  filterable: {},
})

export type UserReservationsSortField = keyof typeof userReservationsEntity.sortable

export const RESERVATION_LIST_ITEM_HYDRATION = {
  listItem: {
    with: {
      item: { with: { image: true } },
      list: {
        with: {
          listUsers: {
            where: eq(listUsers.role, ListUserRoles.OWNER),
            limit: 1,
            with: { user: { with: { avatarImage: true } } },
          },
        },
      },
    },
  },
} as const

type InsertNamedReservationFields = Pick<
  typeof reservations.$inferInsert,
  'listItemId' | 'quantityBooked' | 'reserverName' | 'reserverEmail' | 'anonymousTokenHash'
>

export async function insertNamedReservation(
  input: InsertNamedReservationFields,
  tx: DbOrTx,
): Promise<Reservation | undefined> {
  const [row] = await tx.insert(reservations).values(input).returning()
  return row
}

interface NamedReservationIdentity {
  listItemId: string
  reserverName: string
  reserverEmail: string | null
}

export function findNamedReservationDuplicate(
  identity: NamedReservationIdentity,
  tx: DbOrTx,
): Promise<Reservation | undefined> {
  const sameName = sql`lower(${reservations.reserverName}) = lower(${identity.reserverName})`
  const sameEmail = identity.reserverEmail === null
    ? undefined
    : eq(reservations.reserverEmail, identity.reserverEmail)
  return tx.query.reservations.findFirst({
    where: and(eq(reservations.listItemId, identity.listItemId), or(sameName, sameEmail)),
  })
}

export function findReservationByIdWithListItem(id: string): Promise<ReservationRowHydrated | undefined> {
  return db.query.reservations.findFirst({
    where: eq(reservations.id, id),
    with: RESERVATION_LIST_ITEM_HYDRATION,
  })
}

export async function findReservationByIdForUpdate(
  id: string,
  tx: DbOrTx,
): Promise<Reservation | undefined> {
  const [row] = await tx.select().from(reservations).where(eq(reservations.id, id)).for('update')
  return row
}

export function findReservationByListItemAndUser(
  listItemId: string,
  userId: string,
  tx: DbOrTx = db,
): Promise<Reservation | undefined> {
  return tx.query.reservations.findFirst({
    where: and(eq(reservations.listItemId, listItemId), eq(reservations.userId, userId)),
  })
}

export function findReservationsByUserId(userId: string, tx: DbOrTx = db): Promise<Reservation[]> {
  return tx.query.reservations.findMany({ where: eq(reservations.userId, userId) })
}

export function findReservationsForUser(
  userId: string,
  pagination: PaginationQueryParsed,
  sort: SortInput<UserReservationsSortField> | undefined,
): Promise<Reservation[]> {
  const offset = getOffset(pagination)
  return db.query.reservations.findMany({
    where: eq(reservations.userId, userId),
    orderBy: userReservationsEntity.buildOrderBy(sort),
    limit: pagination.limit,
    offset,
  })
}

export async function countReservationsForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(reservations)
    .where(eq(reservations.userId, userId))
  return row?.count ?? 0
}

export function findReservationsByListItemId(listItemId: string): Promise<Reservation[]> {
  return db.query.reservations.findMany({
    where: eq(reservations.listItemId, listItemId),
    orderBy: desc(reservations.createdAt),
  })
}

export async function deleteReservation(id: string, tx?: DbOrTx): Promise<Reservation | undefined> {
  const executor = tx ?? db
  const [row] = await executor.delete(reservations).where(eq(reservations.id, id)).returning()
  return row
}

interface UpsertReservationQuantityInput {
  listItemId: string
  userId: string
  quantityBooked: number
}

export async function upsertReservationQuantity(
  input: UpsertReservationQuantityInput,
  tx?: DbOrTx,
): Promise<Reservation | undefined> {
  const executor = tx ?? db
  const [row] = await executor
    .insert(reservations)
    .values(input)
    .onConflictDoUpdate({
      target: [reservations.listItemId, reservations.userId],
      set: { quantityBooked: input.quantityBooked },
    })
    .returning()
  return row
}

export async function countReservationsByItemIds(itemIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (itemIds.length === 0) return map

  const rows = await db
    .select({ itemId: listItems.itemId, total: count(reservations.id) })
    .from(listItems)
    .leftJoin(reservations, eq(reservations.listItemId, listItems.id))
    .where(inArray(listItems.itemId, itemIds))
    .groupBy(listItems.itemId)

  for (const row of rows) {
    map.set(row.itemId, row.total)
  }
  return map
}

export async function countReservationsByUserIds(userIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (userIds.length === 0) return map

  const rows = await db
    .select({ userId: reservations.userId, total: count() })
    .from(reservations)
    .where(inArray(reservations.userId, userIds))
    .groupBy(reservations.userId)

  for (const row of rows) {
    if (row.userId !== null) map.set(row.userId, row.total)
  }
  return map
}
