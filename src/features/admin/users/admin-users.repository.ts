import { db } from '../../../db/client.js'
import { users } from '../../../db/entities/users/users.schema.js'
import { and, count, eq, gte, lte, type SQL } from 'drizzle-orm'
import type { User } from '../../../db/entities/users/users.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { UserRole } from '../../../shared/enums/user-role.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import { buildOrderBy, type SortConfig } from '../../../shared/db/sort.js'
import { nullnessFlag, stringContains } from '../../../shared/db/filters.js'

interface AdminInsertUserFields {
  email: string
  username: string | null
  passwordHash: string
  role: UserRole
  passwordResetToken: string
  passwordResetTokenExpiresAt: Date
}

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

const USERS_SORT: SortConfig<AdminUsersSortField> = {
  columns: {
    createdAt: users.createdAt,
    email: users.email,
    lastActiveAt: users.lastActiveAt,
  },
  defaultField: 'createdAt',
  defaultDirection: 'desc',
}

function buildUsersWhere(filters: ListUsersFilters): SQL | undefined {
  return and(
    nullnessFlag(users.deletedAt, filters.isDeleted, false),
    nullnessFlag(users.bannedAt, filters.isBanned),
    stringContains(users.email, filters.email),
    stringContains(users.username, filters.username),
    filters.role !== undefined ? eq(users.role, filters.role) : undefined,
    filters.createdFrom !== undefined ? gte(users.createdAt, new Date(filters.createdFrom)) : undefined,
    filters.createdTo !== undefined ? lte(users.createdAt, new Date(filters.createdTo)) : undefined,
  )
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

  return db
    .select()
    .from(users)
    .where(buildUsersWhere(filters))
    .orderBy(buildOrderBy(USERS_SORT, filters.sort))
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

export async function adminInsertUser(fields: AdminInsertUserFields): Promise<User | undefined> {
  const [user] = await db
    .insert(users)
    .values({
      email: fields.email,
      username: fields.username,
      passwordHash: fields.passwordHash,
      role: fields.role,
      authProvider: 'email',
      isCgvAccepted: false,
      cgvAcceptedAt: null,
      isMarketingOptedIn: false,
      emailVerifiedAt: new Date(),
      emailVerifyToken: null,
      emailVerifyTokenExpiresAt: null,
      passwordResetToken: fields.passwordResetToken,
      passwordResetTokenExpiresAt: fields.passwordResetTokenExpiresAt,
    })
    .returning()

  return user
}
