import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { defineEntity } from '../../../shared/db/entity-descriptor.js'
import { getOffset } from '../../../shared/schemas/pagination.js'
import { reservations } from './reservations.schema.js'
import type { Reservation } from './reservations.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbOrTx = typeof db | DbTransaction

export const RESERVATION_SORTABLE_FIELDS = {
  createdAt: reservations.createdAt,
  quantityBooked: reservations.quantityBooked,
} as const

export const RESERVATION_DEFAULT_SORT = [{ field: 'createdAt' as const, direction: 'desc' as const }]

export const userReservationsEntity = defineEntity({
  sortable: RESERVATION_SORTABLE_FIELDS,
  defaultSort: RESERVATION_DEFAULT_SORT,
  filterable: {},
})

export type UserReservationsSortField = keyof typeof userReservationsEntity.sortable

interface CreateReservationInput {
  listItemId: string
  userId: string
  quantityBooked: number
}

export async function createReservation(
  input: CreateReservationInput,
  tx?: DbOrTx,
): Promise<Reservation | undefined> {
  const executor = tx ?? db
  const [row] = await executor.insert(reservations).values(input).returning()
  return row
}

export function findReservationById(id: string): Promise<Reservation | undefined> {
  return db.query.reservations.findFirst({ where: eq(reservations.id, id) })
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
  pagination: PaginationInput,
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
