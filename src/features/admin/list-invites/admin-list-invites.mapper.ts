import { toInviteDetail, toListMemberUser } from '../../../shared/types/collaborator.js'
import type { CollaboratorDetail, ListMemberUser } from '../../../shared/types/collaborator.js'
import type { ListInviteWithRelationsRow } from '../../../db/entities/list-invites/list-invites.repository.js'

export type AdminListInviteRow = ListInviteWithRelationsRow

export interface AdminListInviteList {
  id: string
  title: string
  slug: string
}

export interface AdminListInviteDetail extends CollaboratorDetail {
  list: AdminListInviteList
  invitedBy: ListMemberUser | null
  isExpired: boolean
}

export function toAdminListInviteDetail(
  row: AdminListInviteRow,
  now: Date,
): AdminListInviteDetail {
  return {
    ...toInviteDetail(row, row.acceptedByUser),
    list: { id: row.list.id, title: row.list.title, slug: row.list.slug },
    invitedBy: row.invitedByUser ? toListMemberUser(row.invitedByUser) : null,
    isExpired: row.inviteTokenExpiresAt.getTime() <= now.getTime(),
  }
}
