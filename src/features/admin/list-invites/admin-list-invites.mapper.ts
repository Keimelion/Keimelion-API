import { toInviteDetail, toListMemberUser } from '../../../shared/types/collaborator.js'
import type { ListInviteWithRelationsRow } from '../../../db/entities/list-invites/list-invites.repository.js'
import type { AdminCollaboratorInviteDetailParsed } from '@keimelion/sdk/schemas'

export type AdminListInviteRow = ListInviteWithRelationsRow

export type AdminListInviteDetail = AdminCollaboratorInviteDetailParsed

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
