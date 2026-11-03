import type { ListCollaborator } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import type { CollabRole } from '../enums/collab-role.js'
import type { InviteStatus } from '../enums/invite-status.js'
import type { User } from '../../db/entities/users/users.schema.js'
import { toUserDetail } from './user.js'
import type { UserDetail } from './user.js'

export interface CollaboratorSummary {
  user: UserDetail | null
  invitedEmail: string | null
  status: InviteStatus
  role: CollabRole
}

export interface CollaboratorDetail {
  id: string
  listId: string
  user: UserDetail | null
  invitedEmail: string | null
  inviteStatus: InviteStatus
  collabRole: CollabRole
  acceptedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CollaboratorWithUserRow extends ListCollaborator {
  user: User | null
}

export function toCollaboratorSummary(row: CollaboratorWithUserRow): CollaboratorSummary {
  return {
    user: row.user ? toUserDetail(row.user) : null,
    invitedEmail: row.invitedEmail ?? null,
    status: row.inviteStatus,
    role: row.collabRole,
  }
}

export function toCollaboratorDetail(row: CollaboratorWithUserRow): CollaboratorDetail {
  return {
    id: row.id,
    listId: row.listId,
    user: row.user ? toUserDetail(row.user) : null,
    invitedEmail: row.invitedEmail ?? null,
    inviteStatus: row.inviteStatus,
    collabRole: row.collabRole,
    acceptedAt: row.acceptedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
