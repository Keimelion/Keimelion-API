import { randomBytes } from 'crypto'
import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { NodeEnvs } from '../../shared/enums/node-env.js'
import { InviteStatuses } from '../../shared/enums/invite-status.js'
import { env } from '../../config/env.js'
import { hashSha256Hex } from '../../shared/utils/hash.js'
import { logger } from '../../shared/utils/logger.js'
import { runWrite } from '../../shared/utils/admin-write.js'
import { serviceError } from '../../shared/utils/response.js'
import {
  findActiveEditorForList,
  insertEditorListUser,
} from '../../db/entities/list-users/list-users.repository.js'
import {
  findInviteByTokenHash,
  findPendingInviteForList,
  insertListInvite,
  markInviteAccepted,
} from '../../db/entities/list-invites/list-invites.repository.js'
import { toInviteDetail } from '../../shared/types/collaborator.js'
import type { CollaboratorDetail } from '../../shared/types/collaborator.js'
import { toUserDetail } from '../../shared/types/user.js'
import type { User } from '../../db/entities/users/users.schema.js'
import type { ListRowWithOwner } from '../../shared/types/list.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { CreateInviteInput } from './endpoints/collaborators/create-invite.js'
import type { AcceptInviteInput } from './endpoints/collaborators/accept-invite.js'

export const COLLAB_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const INVITE_TOKEN_BYTE_LENGTH = 32

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

  const now = new Date()
  const [existingPendingInvite, existingEditor] = await Promise.all([
    findPendingInviteForList(list.id, now),
    findActiveEditorForList(list.id),
  ])
  if (existingPendingInvite || existingEditor) {
    return serviceError(ErrorCode.COLLAB_ALREADY_MEMBER)
  }

  const rawToken = randomBytes(INVITE_TOKEN_BYTE_LENGTH).toString('hex')
  const tokenHash = hashSha256Hex(rawToken)
  const expiresAt = new Date(now.getTime() + COLLAB_INVITE_TTL_MS)

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

  const outcome = await runWrite(
    () =>
      db.transaction(async (tx) => {
        const acceptedAt = new Date()
        const updated = await markInviteAccepted(invite.id, acceptor.id, acceptedAt, tx)
        if (!updated) return undefined
        const membership = await insertEditorListUser(invite.listId, acceptor.id, tx)
        if (!membership) return undefined
        return updated
      }),
    { fallbackErrorCode: ErrorCode.INTERNAL_ERROR },
  )
  if ('errorCode' in outcome) {
    if (outcome.errorCode === ErrorCode.CONFLICT) return serviceError(ErrorCode.COLLAB_ALREADY_MEMBER)
    return serviceError(outcome.errorCode)
  }

  logInviteAccepted(acceptor.id, invite.listId, invite.id)

  const detail = toInviteDetail(outcome.row)
  return {
    data: { invite: { ...detail, user: toUserDetail(acceptor) } },
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
