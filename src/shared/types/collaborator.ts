import type { ListInvite } from '../../db/entities/list-invites/list-invites.schema.js'
import { InviteStatuses } from '@keimelion/sdk/enums'
import type { InviteStatus, ListUserRole } from '@keimelion/sdk/enums'
import type { ListUserWithUser } from './list.js'
import type { UserRowWithAvatar } from './user.js'
import { toImageDetail } from '../../features/uploads/images.mapper.js'
import type { ImageDetail } from '../../features/uploads/images.mapper.js'

// Identity of a list member as seen by the other members — deliberately narrower than
// UserDetail so an editor never receives the owner's account settings (role, CGV, opt-ins…).
export interface ListMemberUser {
  id: string
  email: string
  username: string | null
  avatar: ImageDetail | null
}

export interface CollaboratorSummary {
  user: ListMemberUser | null
  invitedEmail: string | null
  status: InviteStatus
  role: ListUserRole
}

export interface CollaboratorDetail {
  id: string
  listId: string
  user: ListMemberUser | null
  invitedEmail: string | null
  inviteStatus: InviteStatus
  role: ListUserRole
  acceptedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function toListMemberUser(user: UserRowWithAvatar): ListMemberUser {
  const { avatarImage } = user
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    avatar: avatarImage ? toImageDetail(avatarImage) : null,
  }
}

export function toMemberSummary(row: ListUserWithUser): CollaboratorSummary {
  return {
    user: row.user ? toListMemberUser(row.user) : null,
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

export function toInviteDetail(row: ListInvite, user: UserRowWithAvatar | null = null): CollaboratorDetail {
  return {
    id: row.id,
    listId: row.listId,
    user: user ? toListMemberUser(user) : null,
    invitedEmail: row.invitedEmail,
    inviteStatus: row.inviteStatus,
    role: row.role,
    acceptedAt: row.acceptedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
