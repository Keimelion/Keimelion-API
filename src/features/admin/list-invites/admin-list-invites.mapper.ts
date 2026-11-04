import { toInviteDetail } from '../../../shared/types/collaborator.js'
import type { CollaboratorDetail } from '../../../shared/types/collaborator.js'
import type { ListInviteWithRelationsRow } from '../../../db/entities/list-invites/list-invites.repository.js'

export type AdminListInviteRow = ListInviteWithRelationsRow

export interface AdminListInviteList {
  id: string
  title: string
  slug: string
}

export interface AdminListInviteDetail extends CollaboratorDetail {
  list: AdminListInviteList
  isExpired: boolean
}

export function toAdminListInviteDetail(
  row: AdminListInviteRow,
  now: Date,
): AdminListInviteDetail {
  const base = toInviteDetail(row)
  return {
    ...base,
    list: { id: row.list.id, title: row.list.title, slug: row.list.slug },
    isExpired: row.inviteTokenExpiresAt.getTime() <= now.getTime(),
  }
}
