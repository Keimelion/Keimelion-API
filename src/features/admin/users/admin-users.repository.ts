import { db } from '../../../db/client.js'
import { users } from '../../../db/entities/users/users.schema.js'
import { and, count, eq, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { USER_ROLE_VALUES } from '../../../shared/enums/user-role.js'
import { defineEntity, buildSoftDeleteDefault } from '../../../shared/db/entity-descriptor.js'
import type { User } from '../../../db/entities/users/users.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { UserRole } from '../../../shared/enums/user-role.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'

const roleSchema = z.enum(USER_ROLE_VALUES)

export const usersEntity = defineEntity({
  sortable: {
    createdAt:   users.createdAt,
    email:       users.email,
    username:    users.username,
    lastActiveAt: users.lastActiveAt,
  },
  defaultSort: [{ field: 'createdAt', direction: 'desc' }],
  filterable: {
    email:     { column: users.email,     operators: ['eq', 'ilike'] },
    username:  { column: users.username,  operators: ['eq', 'ilike'] },
    createdAt: { column: users.createdAt, operators: ['gte', 'lte', 'between'], valueType: 'date' },
    bannedAt:  { column: users.bannedAt,  operators: ['isNull'] },
    deletedAt: { column: users.deletedAt, operators: ['isNull'] },
    role:      { column: users.role,      operators: ['eq', 'in'], valueSchema: roleSchema },
  },
})

export type UsersSortField = keyof typeof usersEntity.sortable

export interface ListUsersFilters {
  sort?: SortInput<UsersSortField> | undefined
  genericFilters?: FilterInput[] | undefined
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

function buildUsersWhere(filters: ListUsersFilters): SQL | undefined {
  const generic = filters.genericFilters ?? []
  const genericClause = generic.length > 0 ? usersEntity.buildWhere(generic) : undefined
  return and(buildSoftDeleteDefault(generic, users.deletedAt), genericClause)
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
    orderBy: usersEntity.buildOrderBy(filters.sort),
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
