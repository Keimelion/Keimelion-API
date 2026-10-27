import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users } from '../../db/entities/users/users.schema.js'
import { reservations } from '../../db/entities/reservations/reservations.schema.js'
import { listItems } from '../../db/entities/list-items/list-items.schema.js'
import { lists } from '../../db/entities/lists/lists.schema.js'
import { listCollaborators } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import {
  userReservationsEntity,
  type UserReservationsSortField,
} from '../../db/entities/reservations/reservations.repository.js'
import { CollabRoles } from '../../shared/enums/collab-role.js'
import { getOffset } from '../../shared/schemas/pagination.js'
import { env } from '../../config/env.js'
import { hashPassword } from '../../shared/utils/hash.js'
import type { User } from '../../db/entities/users/users.schema.js'
import type { RegisterInput } from '../auth/endpoints/register.js'
import type { ReservationProfileRow } from '../reservations/reservations.types.js'
import type { PaginationInput } from '../../shared/schemas/pagination.js'
import type { SortInput } from '../../shared/schemas/sort.js'

type SetPasswordResetTokenFields = Partial<Pick<typeof users.$inferInsert, 'passwordResetToken' | 'passwordResetTokenExpiresAt'>>
type ResetPasswordFields = Pick<typeof users.$inferInsert, 'passwordHash' | 'passwordResetToken' | 'passwordResetTokenExpiresAt'>

type UpdateUserProfileFields = Partial<
  Pick<typeof users.$inferInsert, 'username' | 'avatarUrl' | 'avatarImageId' | 'isMarketingOptedIn' | 'defaultCurrencyCode'>
>

export function findUserByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email) })
}

export function findUserByEmailVerifyToken(token: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.emailVerifyToken, token) })
}

export async function insertUser(
  input: RegisterInput,
  emailVerifyToken: string,
  avatarImageId: string | null = null,
): Promise<User | undefined> {
  const passwordHash = await hashPassword(input.password)
  const emailVerifyTokenExpiresAt = new Date(Date.now() + env.EMAIL_VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000)

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      passwordHash,
      authProvider: 'email',
      isCgvAccepted: true,
      cgvAcceptedAt: new Date(),
      isMarketingOptedIn: input.isMarketingOptedIn,
      ...(input.defaultCurrency !== undefined && { defaultCurrencyCode: input.defaultCurrency }),
      ...(avatarImageId !== null && { avatarImageId }),
      emailVerifyToken,
      emailVerifyTokenExpiresAt,
    })
    .returning()

  return user
}

export async function markEmailAsVerified(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), emailVerifyToken: null, emailVerifyTokenExpiresAt: null })
    .where(eq(users.id, userId))
}

export async function updateLastActiveAt(userId: string): Promise<void> {
  await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId))
}

export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileFields,
): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set(input)
    .where(eq(users.id, userId))
    .returning()

  return user
}

export function findUserByPasswordResetToken(tokenHash: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.passwordResetToken, tokenHash) })
}

export async function setPasswordResetToken(userId: string, input: SetPasswordResetTokenFields): Promise<void> {
  await db.update(users).set(input).where(eq(users.id, userId))
}

export async function resetUserPassword(userId: string, input: ResetPasswordFields): Promise<void> {
  await db.update(users).set(input).where(eq(users.id, userId))
}

const MY_RESERVATIONS_HYDRATION = {
  listItem: {
    with: {
      item: true,
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

function myReservationsWhere(userId: string): ReturnType<typeof and> {
  const activeListItemIds = db
    .select({ id: listItems.id })
    .from(listItems)
    .innerJoin(lists, eq(listItems.listId, lists.id))
    .where(isNull(lists.deletedAt))
  return and(
    eq(reservations.userId, userId),
    inArray(reservations.listItemId, activeListItemIds),
  )
}

export async function findMyReservationsPaged(
  userId: string,
  pagination: PaginationInput,
  sort: SortInput<UserReservationsSortField> | undefined,
): Promise<ReservationProfileRow[]> {
  const offset = getOffset(pagination)
  const rows = await db.query.reservations.findMany({
    where: myReservationsWhere(userId),
    orderBy: userReservationsEntity.buildOrderBy(sort),
    limit: pagination.limit,
    offset,
    with: MY_RESERVATIONS_HYDRATION,
  })
  return rows
}

export async function countMyReservations(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(reservations)
    .where(myReservationsWhere(userId))
  return row?.count ?? 0
}
