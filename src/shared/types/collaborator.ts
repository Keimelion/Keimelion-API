import type { ListInvite } from '../../db/entities/list-invites/list-invites.schema.js'
import type { ListUserWithUserRow } from '../../db/entities/list-users/list-users.repository.js'
import type { ListUserRole } from '../enums/list-user-role.js'
import type { InviteStatus } from '../enums/invite-status.js'
import { toUserDetail } from './user.js'
import type { UserDetail } from './user.js'
import { InviteStatuses } from '../enums/invite-status.js'

export interface CollaboratorSummary {
  user: UserDetail | null
  invitedEmail: string | null
  status: InviteStatus
  role: ListUserRole
}

export interface CollaboratorDetail {
  id: string
  listId: string
  user: UserDetail | null
  invitedEmail: string | null
  inviteStatus: InviteStatus
  role: ListUserRole
  acceptedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function toMemberSummary(row: ListUserWithUserRow): CollaboratorSummary {
  return {
    user: row.user ? toUserDetail(row.user) : null,
    invitedEmail: null,
    status: InviteStatuses.ACCEPTED,
    role: row.role,
  }
}

export function toPendingInviteSummary(row: ListInvite): CollaboratorSummary {
  return {
    user: null,
    invitedEmail: row.invitedEmail,
    status: row.inviteStatus,
    role: row.role,
  }
}

export function toInviteDetail(row: ListInvite): CollaboratorDetail {
  return {
    id: row.id,
    listId: row.listId,
    user: null,
    invitedEmail: row.invitedEmail,
    inviteStatus: row.inviteStatus,
    role: row.role,
    acceptedAt: row.acceptedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
