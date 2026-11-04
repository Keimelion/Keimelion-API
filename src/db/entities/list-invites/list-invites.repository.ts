import { and, asc, count, desc, eq, gt, inArray, lte, type SQL } from 'drizzle-orm'
import { db } from '../../client.js'
import { InviteStatuses } from '../../../shared/enums/invite-status.js'
import type { InviteStatus } from '../../../shared/enums/invite-status.js'
import { listInvites } from './list-invites.schema.js'
import type { ListInvite } from './list-invites.schema.js'
import type { List } from '../lists/lists.schema.js'
import type { UserRowWithAvatar } from '../../../shared/types/user.js'
import { getOffset } from '../../../shared/schemas/pagination.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface ListInviteWithRelationsRow extends ListInvite {
  list: List
  invitedByUser: UserRowWithAvatar | null
  acceptedByUser: UserRowWithAvatar | null
}

export function findInviteByTokenHash(tokenHash: string): Promise<ListInvite | undefined> {
  return db.query.listInvites.findFirst({
    where: eq(listInvites.inviteToken, tokenHash),
  })
}

export function findActivePendingInvitesForLists(
  listIds: string[],
  now: Date,
): Promise<ListInvite[]> {
  if (listIds.length === 0) return Promise.resolve([])
  return db.query.listInvites.findMany({
    where: and(
      inArray(listInvites.listId, listIds),
      eq(listInvites.inviteStatus, InviteStatuses.PENDING),
      gt(listInvites.inviteTokenExpiresAt, now),
    ),
    orderBy: [asc(listInvites.createdAt)],
  })
}

export interface InsertListInviteInput {
  listId: string
  invitedByUserId: string
  invitedEmail: string
  inviteTokenHash: string
  inviteTokenExpiresAt: Date
}

export async function insertListInvite(
  input: InsertListInviteInput,
): Promise<ListInvite | undefined> {
  const [row] = await db
    .insert(listInvites)
    .values({
      listId: input.listId,
      invitedByUserId: input.invitedByUserId,
      invitedEmail: input.invitedEmail,
      inviteToken: input.inviteTokenHash,
      inviteTokenExpiresAt: input.inviteTokenExpiresAt,
    })
    .returning()
  return row
}

// Atomic claim: the WHERE narrows to "still pending AND not expired" so a concurrent
// accept / revoke / expiry loses the race and returns undefined. Callers must treat
// `undefined` as "the invite was resolved or expired between read and write" rather
// than a generic failure.
export async function markInviteAccepted(
  inviteId: string,
  acceptedByUserId: string,
  acceptedAt: Date,
  tx?: DbOrTx,
): Promise<ListInvite | undefined> {
  const executor = tx ?? db
  const [row] = await executor
    .update(listInvites)
    .set({
      inviteStatus: InviteStatuses.ACCEPTED,
      acceptedByUserId,
      acceptedAt,
    })
    .where(
      and(
        eq(listInvites.id, inviteId),
        eq(listInvites.inviteStatus, InviteStatuses.PENDING),
        gt(listInvites.inviteTokenExpiresAt, acceptedAt),
      ),
    )
    .returning()
  return row
}

export interface ListInviteFilters {
  inviteStatus?: InviteStatus | undefined
}

export function findAllListInvites(
  pagination: PaginationInput,
  filters: ListInviteFilters,
): Promise<ListInviteWithRelationsRow[]> {
  const offset = getOffset(pagination)
  return db.query.listInvites.findMany({
    where: buildInviteWhere(filters),
    orderBy: [desc(listInvites.createdAt)],
    limit: pagination.limit,
    offset,
    with: {
      list: true,
      invitedByUser: { with: { avatarImage: true } },
      acceptedByUser: { with: { avatarImage: true } },
    },
  })
}

export async function countListInvites(filters: ListInviteFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(listInvites)
    .where(buildInviteWhere(filters))
  return row?.count ?? 0
}

// Expired invites stay `pending` in DB, and the partial unique index allows a single pending
// invite per list — so they must be purged (cron + before each new invite on that list).
export async function deleteExpiredPendingListInvites(
  options: { listId?: string; now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date()
  const deleted = await db
    .delete(listInvites)
    .where(
      and(
        eq(listInvites.inviteStatus, InviteStatuses.PENDING),
        lte(listInvites.inviteTokenExpiresAt, now),
        options.listId === undefined ? undefined : eq(listInvites.listId, options.listId),
      ),
    )
    .returning({ id: listInvites.id })
  return deleted.length
}

function buildInviteWhere(filters: ListInviteFilters): SQL | undefined {
  if (filters.inviteStatus === undefined) return undefined
  return eq(listInvites.inviteStatus, filters.inviteStatus)
}
