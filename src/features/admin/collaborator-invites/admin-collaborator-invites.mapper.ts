import { toCollaboratorDetail } from '../../../shared/types/collaborator.js'
import type { CollaboratorDetail } from '../../../shared/types/collaborator.js'
import type { AdminCollaboratorInviteRow } from './admin-collaborator-invites.repository.js'

export interface AdminCollaboratorInviteList {
  id: string
  title: string
  slug: string
}

export interface AdminCollaboratorInviteDetail extends CollaboratorDetail {
  list: AdminCollaboratorInviteList
  isExpired: boolean
}

export function toAdminCollaboratorInviteDetail(
  row: AdminCollaboratorInviteRow,
  now: Date,
): AdminCollaboratorInviteDetail {
  const base = toCollaboratorDetail(row)
  return {
    ...base,
    list: { id: row.list.id, title: row.list.title, slug: row.list.slug },
    isExpired: isInviteExpired(row.inviteTokenExpiresAt, now),
  }
}

function isInviteExpired(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() <= now.getTime()
}
