import { and, asc, eq, gt, inArray, isNull, or } from 'drizzle-orm'
import { db } from '../../client.js'
import { CollabRoles, CONTRIBUTOR_ROLE_VALUES } from '../../../shared/enums/collab-role.js'
import { InviteStatuses } from '../../../shared/enums/invite-status.js'
import { listCollaborators } from './list-collaborators.schema.js'
import type { ListCollaborator } from './list-collaborators.schema.js'
import type { User } from '../users/users.schema.js'

const OWNER_INVITE_STATUS = InviteStatuses.ACCEPTED

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface ListCollaboratorWithUserRow extends ListCollaborator {
  user: User | null
}

export function findListOwner(listId: string, userId: string): Promise<ListCollaborator | undefined> {
  return db.query.listCollaborators.findFirst({
    where: and(
      eq(listCollaborators.listId, listId),
      eq(listCollaborators.userId, userId),
      eq(listCollaborators.collabRole, CollabRoles.OWNER),
    ),
  })
}

export function findListContributor(listId: string, userId: string): Promise<ListCollaborator | undefined> {
  return db.query.listCollaborators.findFirst({
    where: and(
      eq(listCollaborators.listId, listId),
      eq(listCollaborators.userId, userId),
      inArray(listCollaborators.collabRole, [...CONTRIBUTOR_ROLE_VALUES]),
      eq(listCollaborators.inviteStatus, InviteStatuses.ACCEPTED),
    ),
  })
}

export function findActiveEditorForList(
  listId: string,
  now: Date,
): Promise<ListCollaborator | undefined> {
  return db.query.listCollaborators.findFirst({
    where: and(
      eq(listCollaborators.listId, listId),
      eq(listCollaborators.collabRole, CollabRoles.EDITOR),
      or(
        eq(listCollaborators.inviteStatus, InviteStatuses.ACCEPTED),
        and(
          eq(listCollaborators.inviteStatus, InviteStatuses.PENDING),
          or(
            isNull(listCollaborators.inviteTokenExpiresAt),
            gt(listCollaborators.inviteTokenExpiresAt, now),
          ),
        ),
      ),
    ),
  })
}

export function findInviteByTokenHash(tokenHash: string): Promise<ListCollaborator | undefined> {
  return db.query.listCollaborators.findFirst({
    where: eq(listCollaborators.inviteToken, tokenHash),
  })
}

export function findCollaboratorsForListsWithUser(
  listIds: string[],
  now: Date,
): Promise<ListCollaboratorWithUserRow[]> {
  if (listIds.length === 0) return Promise.resolve([])
  return db.query.listCollaborators.findMany({
    where: and(
      inArray(listCollaborators.listId, listIds),
      or(
        eq(listCollaborators.collabRole, CollabRoles.OWNER),
        and(
          eq(listCollaborators.collabRole, CollabRoles.EDITOR),
          or(
            eq(listCollaborators.inviteStatus, InviteStatuses.ACCEPTED),
            and(
              eq(listCollaborators.inviteStatus, InviteStatuses.PENDING),
              or(
                isNull(listCollaborators.inviteTokenExpiresAt),
                gt(listCollaborators.inviteTokenExpiresAt, now),
              ),
            ),
          ),
        ),
      ),
    ),
    orderBy: [asc(listCollaborators.createdAt)],
    with: { user: true },
  })
}

export interface InsertEditorInviteInput {
  listId: string
  invitedEmail: string
  inviteTokenHash: string
  inviteTokenExpiresAt: Date
}

export async function insertEditorInvite(
  input: InsertEditorInviteInput,
): Promise<ListCollaborator | undefined> {
  const [row] = await db
    .insert(listCollaborators)
    .values({
      listId: input.listId,
      userId: null,
      invitedEmail: input.invitedEmail,
      collabRole: CollabRoles.EDITOR,
      inviteStatus: InviteStatuses.PENDING,
      inviteToken: input.inviteTokenHash,
      inviteTokenExpiresAt: input.inviteTokenExpiresAt,
    })
    .returning()
  return row
}

export async function markInviteAccepted(
  inviteId: string,
  userId: string,
  acceptedAt: Date,
): Promise<ListCollaborator | undefined> {
  const [row] = await db
    .update(listCollaborators)
    .set({
      inviteStatus: InviteStatuses.ACCEPTED,
      userId,
      acceptedAt,
    })
    .where(eq(listCollaborators.id, inviteId))
    .returning()
  return row
}

export async function insertOwnerCollaborator(
  listId: string,
  userId: string,
  tx?: DbOrTx,
): Promise<ListCollaborator | undefined> {
  const executor = tx ?? db
  const now = new Date()
  const [row] = await executor
    .insert(listCollaborators)
    .values({
      listId,
      userId,
      collabRole: CollabRoles.OWNER,
      inviteStatus: OWNER_INVITE_STATUS,
      acceptedAt: now,
    })
    .returning()
  return row
}
