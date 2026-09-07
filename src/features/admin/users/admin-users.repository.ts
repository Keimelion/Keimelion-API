import { db } from '../../../db/client.js'
import { users } from '../../../db/entities/users/users.schema.js'
import { and, asc, count, desc, eq, gte, ilike, isNotNull, isNull, lte, type SQL } from 'drizzle-orm'
import type { User } from '../../../db/entities/users/users.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { UserRole } from '../../../shared/enums/user-role.js'
import type { SortInput } from '../../../shared/schemas/sort.js'

type AdminUpdateUserFields = Partial<Pick<typeof users.$inferInsert, 'avatarUrl' | 'isMarketingOptedIn' | 'role'>>

export type AdminUsersSortField = 'createdAt' | 'email' | 'lastActiveAt'

export interface ListUsersFilters {
  email?: string | undefined
  username?: string | undefined
  role?: UserRole | undefined
  isBanned?: boolean | undefined
  isDeleted?: boolean | undefined
  createdFrom?: string | undefined
  createdTo?: string | undefined
  sort?: SortInput<AdminUsersSortField> | undefined
}

const SORT_FIELD_MAP = {
  createdAt: users.createdAt,
  email: users.email,
  lastActiveAt: users.lastActiveAt,
} as const

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function buildUsersWhere(filters: ListUsersFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = []

  const isDeleted = filters.isDeleted ?? false
  if (isDeleted) {
    conditions.push(isNotNull(users.deletedAt))
  } else {
    conditions.push(isNull(users.deletedAt))
  }

  if (filters.email !== undefined) {
    conditions.push(ilike(users.email, `%${escapeIlikePattern(filters.email)}%`))
  }

  if (filters.username !== undefined) {
    conditions.push(ilike(users.username, `%${escapeIlikePattern(filters.username)}%`))
  }

  if (filters.role !== undefined) {
    conditions.push(eq(users.role, filters.role))
  }

  if (filters.isBanned === true) {
    conditions.push(isNotNull(users.bannedAt))
  } else if (filters.isBanned === false) {
    conditions.push(isNull(users.bannedAt))
  }

  if (filters.createdFrom !== undefined) {
    conditions.push(gte(users.createdAt, new Date(filters.createdFrom)))
  }

  if (filters.createdTo !== undefined) {
    conditions.push(lte(users.createdAt, new Date(filters.createdTo)))
  }

  return and(...conditions)
}

export async function countUsers(filters: ListUsersFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(users)
    .where(buildUsersWhere(filters))
  return row?.count ?? 0
}

export async function findAllUsers(input: PaginationInput, filters: ListUsersFilters): Promise<User[]> {
  const offset = (input.page - 1) * input.limit
  const sortField = filters.sort?.field ?? 'createdAt'
  const sortDirection = filters.sort?.direction ?? 'desc'
  const column = SORT_FIELD_MAP[sortField]
  const orderFn = sortDirection === 'asc' ? asc : desc

  return db
    .select()
    .from(users)
    .where(buildUsersWhere(filters))
    .orderBy(orderFn(column))
    .limit(input.limit)
    .offset(offset)
}

export async function adminUpdateUser(
  id: string,
  input: AdminUpdateUserFields,
): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set(input)
    .where(eq(users.id, id))
    .returning()

  return user
}
