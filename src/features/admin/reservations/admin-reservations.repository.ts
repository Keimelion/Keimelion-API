import { and, count, eq, inArray, type SQL } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { reservations } from '../../../db/entities/reservations/reservations.schema.js'
import { listItems } from '../../../db/entities/list-items/list-items.schema.js'
import { listCollaborators } from '../../../db/entities/list-collaborators/list-collaborators.schema.js'
import { CollabRoles } from '../../../shared/enums/collab-role.js'
import {
  RESERVATION_SORTABLE_FIELDS,
  RESERVATION_DEFAULT_SORT,
} from '../../../db/entities/reservations/reservations.repository.js'
import { defineEntity } from '../../../shared/db/entity-descriptor.js'
import { getOffset } from '../../../shared/schemas/pagination.js'
import type { AdminReservationRow } from './admin-reservations.mapper.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'

export const adminReservationsEntity = defineEntity({
  sortable: RESERVATION_SORTABLE_FIELDS,
  defaultSort: RESERVATION_DEFAULT_SORT,
  filterable: {},
})

export type AdminReservationsSortField = keyof typeof adminReservationsEntity.sortable

export interface AdminReservationsFilters {
  userId?: string | undefined
  listItemId?: string | undefined
  listId?: string | undefined
}

export interface AdminReservationsScopedFilters {
  userId?: string | undefined
  listItemId?: string | undefined
  listItemIds?: readonly string[] | undefined
}

const RESERVATION_HYDRATION = {
  user: true,
  listItem: {
    with: {
      item: true,
      image: true,
      list: {
        with: {
          collaborators: {
            where: eq(listCollaborators.collabRole, CollabRoles.OWNER),
            limit: 1,
            with: { user: true },
          },
        },
      },
    },
  },
} as const

export async function resolveListItemIdsForList(listId: string): Promise<string[]> {
  const rows = await db
    .select({ id: listItems.id })
    .from(listItems)
    .where(eq(listItems.listId, listId))
  return rows.map((row) => row.id)
}

function buildWhere(filters: AdminReservationsScopedFilters): SQL | undefined {
  const clauses: SQL[] = []
  if (filters.userId !== undefined) clauses.push(eq(reservations.userId, filters.userId))
  if (filters.listItemId !== undefined) clauses.push(eq(reservations.listItemId, filters.listItemId))
  if (filters.listItemIds !== undefined) {
    clauses.push(inArray(reservations.listItemId, [...filters.listItemIds]))
  }
  if (clauses.length === 0) return undefined
  if (clauses.length === 1) return clauses[0]
  return and(...clauses)
}

export async function findReservationsPaged(
  filters: AdminReservationsScopedFilters,
  pagination: PaginationInput,
  sort: SortInput<AdminReservationsSortField> | undefined,
): Promise<AdminReservationRow[]> {
  const offset = getOffset(pagination)
  const rows = await db.query.reservations.findMany({
    where: buildWhere(filters),
    orderBy: adminReservationsEntity.buildOrderBy(sort),
    limit: pagination.limit,
    offset,
    with: RESERVATION_HYDRATION,
  })
  return rows as AdminReservationRow[]
}

export async function countReservations(filters: AdminReservationsScopedFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(reservations)
    .where(buildWhere(filters))
  return row?.count ?? 0
}

export async function findReservationByIdHydrated(
  id: string,
): Promise<AdminReservationRow | undefined> {
  const row = await db.query.reservations.findFirst({
    where: eq(reservations.id, id),
    with: RESERVATION_HYDRATION,
  })
  return row as AdminReservationRow | undefined
}

export async function findReservationsByItemId(itemId: string): Promise<AdminReservationRow[]> {
  const listItemRows = await db
    .select({ id: listItems.id })
    .from(listItems)
    .where(eq(listItems.itemId, itemId))
  const listItemIds = listItemRows.map((row) => row.id)
  if (listItemIds.length === 0) return []

  const rows = await db.query.reservations.findMany({
    where: inArray(reservations.listItemId, listItemIds),
    with: RESERVATION_HYDRATION,
  })
  return rows as AdminReservationRow[]
}
