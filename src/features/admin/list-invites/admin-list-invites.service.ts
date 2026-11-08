import { buildPaginatedResponse } from '../../../shared/utils/pagination.js'
import { HttpStatus } from '@keimelion/sdk/enums'
import type {
  AdminCollaboratorInvitesListQueryParsed,
  PaginatedResponse,
} from '@keimelion/sdk/schemas'
import {
  countListInvites,
  findAllListInvites,
} from '../../../db/entities/list-invites/list-invites.repository.js'
import { toAdminListInviteDetail } from './admin-list-invites.mapper.js'
import type { AdminListInviteDetail } from './admin-list-invites.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'

export async function listAdminInvites(
  input: AdminCollaboratorInvitesListQueryParsed,
): Promise<ServiceResult<PaginatedResponse<AdminListInviteDetail>>> {
  const filters = { inviteStatus: input.inviteStatus }
  const [rows, total] = await Promise.all([
    findAllListInvites(input, filters),
    countListInvites(filters),
  ])

  const now = new Date()
  return {
    data: buildPaginatedResponse(
      rows.map((row) => toAdminListInviteDetail(row, now)),
      input,
      total,
    ),
    httpStatus: HttpStatus.OK,
  }
}
