import { randomBytes } from 'crypto'
import { db } from '../../db/client.js'
import { ErrorCode, HttpStatus, InviteStatuses, ListUserRoles } from '@keimelion/sdk/enums'
import { NodeEnvs } from '../../shared/enums/node-env.js'
import { env } from '../../config/env.js'
import { hashSha256Hex } from '../../shared/utils/hash.js'
import { logger } from '../../shared/utils/logger.js'
import { runWrite } from '../../shared/utils/admin-write.js'
import { isPgUniqueViolation } from '../../shared/db/pg-errors.js'
import { serviceError } from '../../shared/utils/response.js'
import { findActiveEditorForList, insertListUser } from '../../db/entities/list-users/list-users.repository.js'
import { findUserByIdWithAvatar } from '../../db/entities/users/users.repository.js'
import {
  deleteExpiredPendingListInvites,
  findInviteByTokenHash,
  insertListInvite,
  markInviteAccepted,
} from '../../db/entities/list-invites/list-invites.repository.js'
import { findListById } from '../../db/entities/lists/lists.repository.js'
import { toInviteDetail } from '../../shared/types/collaborator.js'
import type { CollaboratorDetail } from '../../shared/types/collaborator.js'
import type { User } from '../../db/entities/users/users.schema.js'
import type { ListRowWithOwner } from '../../shared/types/list.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { CreateInviteInput } from './endpoints/collaborators/create-invite.js'
import type { AcceptInviteInput } from './endpoints/collaborators/accept-invite.js'

export const COLLAB_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Raw token sent to the invitee; independent from the stored hash width (SHA256_HEX_LENGTH).
export const INVITE_TOKEN_BYTE_LENGTH = 32
export const INVITE_TOKEN_HEX_LENGTH = INVITE_TOKEN_BYTE_LENGTH * 2

// Thrown from inside the accept transaction to roll both writes back when the TOCTOU-safe
// UPDATE loses the race (status changed or expiry passed between read and write).
class InviteResolvedError extends Error {
  override readonly name = 'InviteResolvedError'
}

export interface CreateInviteResponse {
  invite: CollaboratorDetail
  inviteToken?: string
}

export async function createListInvite(
  list: ListRowWithOwner,
  owner: User,
  input: CreateInviteInput,
): Promise<ServiceResult<CreateInviteResponse>> {
  if (input.email === owner.email.toLowerCase()) {
    return serviceError(ErrorCode.COLLAB_SELF_INVITE)
  }

  const existingEditor = await findActiveEditorForList(list.id)
  if (existingEditor) return serviceError(ErrorCode.COLLAB_ALREADY_MEMBER)

  // Frees the single pending slot if the previous invite expired since the last cron run.
  await deleteExpiredPendingListInvites({ listId: list.id })

  const rawToken = randomBytes(INVITE_TOKEN_BYTE_LENGTH).toString('hex')
  const tokenHash = hashSha256Hex(rawToken)
  const expiresAt = new Date(Date.now() + COLLAB_INVITE_TTL_MS)

  // Partial unique index uniq_list_invites_pending_per_list catches a concurrent
  // pending-invite via runWrite → CONFLICT; mapped to COLLAB_ALREADY_MEMBER below.
  const outcome = await runWrite(
    () =>
      insertListInvite({
        listId: list.id,
        invitedByUserId: owner.id,
        invitedEmail: input.email,
        inviteTokenHash: tokenHash,
        inviteTokenExpiresAt: expiresAt,
      }),
    { fallbackErrorCode: ErrorCode.INTERNAL_ERROR },
  )
  if ('errorCode' in outcome) {
    if (outcome.errorCode === ErrorCode.CONFLICT) return serviceError(ErrorCode.COLLAB_ALREADY_MEMBER)
    return serviceError(outcome.errorCode)
  }

  logInviteCreated(owner.id, list.id, input.email, rawToken)

  const invite = toInviteDetail(outcome.row)
  const response: CreateInviteResponse = { invite }
  if (env.NODE_ENV !== NodeEnvs.PRODUCTION) {
    response.inviteToken = rawToken
  }
  return { data: response, httpStatus: HttpStatus.CREATED }
}

export async function acceptListInvite(
  acceptor: User,
  input: AcceptInviteInput,
): Promise<ServiceResult<{ invite: CollaboratorDetail }>> {
  if (!acceptor.emailVerifiedAt) return serviceError(ErrorCode.EMAIL_NOT_VERIFIED)

  const tokenHash = hashSha256Hex(input.token)
  const invite = await findInviteByTokenHash(tokenHash)
  if (!invite) return serviceError(ErrorCode.COLLAB_INVITE_NOT_FOUND)
  if (invite.inviteStatus !== InviteStatuses.PENDING) {
    return serviceError(ErrorCode.COLLAB_INVITE_ALREADY_RESOLVED)
  }
  if (invite.inviteTokenExpiresAt.getTime() <= Date.now()) {
    return serviceError(ErrorCode.COLLAB_INVITE_EXPIRED)
  }
  if (invite.invitedEmail.toLowerCase() !== acceptor.email.toLowerCase()) {
    return serviceError(ErrorCode.COLLAB_EMAIL_MISMATCH)
  }
  const list = await findListById(invite.listId)
  if (!list) return serviceError(ErrorCode.COLLAB_INVITE_NOT_FOUND)

  // markInviteAccepted's WHERE filters on status='pending' AND expiry > now, so a
  // concurrent accept/revoke/expiry returns undefined. Throwing InviteResolvedError
  // inside the transaction rolls both writes back; the outer catch maps it to
  // COLLAB_INVITE_ALREADY_RESOLVED rather than a generic fallback error.
  let acceptedInvite
  try {
    acceptedInvite = await db.transaction(async (tx) => {
      const acceptedAt = new Date()
      const updated = await markInviteAccepted(invite.id, acceptor.id, acceptedAt, tx)
      if (!updated) throw new InviteResolvedError('Invite was resolved or expired')
      const membership = await insertListUser(invite.listId, acceptor.id, ListUserRoles.EDITOR, tx)
      if (!membership) throw new Error('Editor list_users insert returned no row')
      return updated
    })
  } catch (error) {
    if (error instanceof InviteResolvedError) {
      return serviceError(ErrorCode.COLLAB_INVITE_ALREADY_RESOLVED)
    }
    if (isPgUniqueViolation(error)) return serviceError(ErrorCode.COLLAB_ALREADY_MEMBER)
    logger.error({ error, inviteId: invite.id }, 'Collaborator invite accept failed')
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  logInviteAccepted(acceptor.id, invite.listId, invite.id)

  const acceptorWithAvatar = (await findUserByIdWithAvatar(acceptor.id)) ?? null
  return {
    data: { invite: toInviteDetail(acceptedInvite, acceptorWithAvatar) },
    httpStatus: HttpStatus.OK,
  }
}

function logInviteCreated(ownerId: string, listId: string, invitedEmail: string, rawToken: string): void {
  if (env.NODE_ENV !== NodeEnvs.PRODUCTION) {
    logger.info({ ownerId, listId, invitedEmail, rawToken }, 'Collaborator invite created (dev/test)')
    return
  }
  logger.info({ ownerId, listId, invitedEmail }, 'Collaborator invite created')
}

function logInviteAccepted(acceptorId: string, listId: string, inviteId: string): void {
  logger.info({ acceptorId, listId, inviteId }, 'Collaborator invite accepted')
}
