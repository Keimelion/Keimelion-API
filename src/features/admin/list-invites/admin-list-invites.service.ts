import { HttpStatus } from '../../../shared/enums/http.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import {
  countAdminListInvites,
  findAllAdminListInvites,
} from './admin-list-invites.repository.js'
import { toAdminListInviteDetail } from './admin-list-invites.mapper.js'
import type { AdminListInviteDetail } from './admin-list-invites.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { ListAdminInvitesInput } from './endpoints/list.js'

export async function listAdminInvites(
  input: ListAdminInvitesInput,
): Promise<ServiceResult<PaginatedResponse<AdminListInviteDetail>>> {
  const filters = { inviteStatus: input.inviteStatus }
  const [rows, total] = await Promise.all([
    findAllAdminListInvites(input, filters),
    countAdminListInvites(filters),
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
