import { and, asc, count, desc, eq, gt, inArray, type SQL } from 'drizzle-orm'
import { db } from '../../client.js'
import { InviteStatuses } from '../../../shared/enums/invite-status.js'
import type { InviteStatus } from '../../../shared/enums/invite-status.js'
import { listInvites } from './list-invites.schema.js'
import type { ListInvite } from './list-invites.schema.js'
import type { List } from '../lists/lists.schema.js'
import type { User } from '../users/users.schema.js'
import { getOffset } from '../../../shared/schemas/pagination.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface ListInviteWithRelationsRow extends ListInvite {
  list: List
  invitedByUser: User | null
  acceptedByUser: User | null
}

export function findPendingInviteForList(listId: string, now: Date): Promise<ListInvite | undefined> {
  return db.query.listInvites.findFirst({
    where: and(
      eq(listInvites.listId, listId),
      eq(listInvites.inviteStatus, InviteStatuses.PENDING),
      gt(listInvites.inviteTokenExpiresAt, now),
    ),
  })
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
    .where(eq(listInvites.id, inviteId))
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
    with: { list: true, invitedByUser: true, acceptedByUser: true },
  })
}

export async function countListInvites(filters: ListInviteFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(listInvites)
    .where(buildInviteWhere(filters))
  return row?.count ?? 0
}

export async function findInvitesForOwnerListsExport(listIds: string[]): Promise<ListInvite[]> {
  if (listIds.length === 0) return []
  return db.query.listInvites.findMany({
    where: inArray(listInvites.listId, listIds),
  })
}

function buildInviteWhere(filters: ListInviteFilters): SQL | undefined {
  if (filters.inviteStatus === undefined) return undefined
  return eq(listInvites.inviteStatus, filters.inviteStatus)
}
