import { db } from '../../../db/client.js'
import { users } from '../../../db/entities/users/users.schema.js'
import { and, count, eq, isNull, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { USER_ROLE_VALUES } from '../../../shared/enums/user-role.js'
import type { User } from '../../../db/entities/users/users.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { UserRole } from '../../../shared/enums/user-role.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import { buildOrderBy, type SortConfig } from '../../../shared/db/sort.js'
import { buildGenericWhere } from '../../../shared/db/filter-where.js'
import type { FilterConfig } from '../../../shared/db/filter-config.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'

interface AdminUsersFilterEntity {
  email: string
  username: string
  createdAt: Date
  bannedAt: Date | null
  deletedAt: Date | null
  role: string
}

const roleSchema = z.enum(USER_ROLE_VALUES)

export const usersGenericFilterConfig: FilterConfig<AdminUsersFilterEntity> = {
  email:     { column: users.email,     operators: ['eq', 'ilike'] },
  username:  { column: users.username,  operators: ['eq', 'ilike'] },
  createdAt: { column: users.createdAt, operators: ['gte', 'lte', 'between'], valueType: 'date' },
  bannedAt:  { column: users.bannedAt,  operators: ['isNull'] },
  deletedAt: { column: users.deletedAt, operators: ['isNull'] },
  role:      { column: users.role,      operators: ['eq', 'in'], valueSchema: roleSchema },
}

interface AdminInsertUserFields {
  email: string
  username: string | null
  passwordHash: string
  role: UserRole
  passwordResetToken: string
  passwordResetTokenExpiresAt: Date
}

type AdminUpdateUserFields = Partial<Pick<typeof users.$inferInsert, 'avatarUrl' | 'isMarketingOptedIn' | 'role'>>

export type AdminUsersSortField = 'createdAt' | 'email' | 'username' | 'lastActiveAt'

export interface ListUsersFilters {
  sort?: SortInput<AdminUsersSortField> | undefined
  genericFilters?: FilterInput[] | undefined
}

const USERS_SORT: SortConfig<AdminUsersSortField> = {
  columns: {
    createdAt: users.createdAt,
    email: users.email,
    username: users.username,
    lastActiveAt: users.lastActiveAt,
  },
  defaultField: 'createdAt',
  defaultDirection: 'desc',
}

function buildUsersWhere(filters: ListUsersFilters): SQL | undefined {
  const generic = filters.genericFilters ?? []
  const hasDeletedAtFilter = generic.some((filter) => filter.field === 'deletedAt')
  const softDeleteDefault = hasDeletedAtFilter ? undefined : isNull(users.deletedAt)
  const genericClause = generic.length > 0 ? buildGenericWhere(usersGenericFilterConfig, generic) : undefined

  return and(softDeleteDefault, genericClause)
}

export async function countUsers(filters: ListUsersFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(users)
    .where(buildUsersWhere(filters))
  return row?.count ?? 0
}

export function findAllUsers(input: PaginationInput, filters: ListUsersFilters): Promise<User[]> {
  const offset = (input.page - 1) * input.limit

  return db.query.users.findMany({
    where: buildUsersWhere(filters),
    orderBy: buildOrderBy(USERS_SORT, filters.sort),
    limit: input.limit,
    offset,
  })
}

export async function adminUpdateUser(
  id: string,
  input: AdminUpdateUserFields,
  tx?: DbTransaction,
): Promise<User | undefined> {
  const [user] = await (tx ?? db)
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
