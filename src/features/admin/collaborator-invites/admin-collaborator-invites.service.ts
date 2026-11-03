import { HttpStatus } from '../../../shared/enums/http.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import {
  countCollaboratorInvites,
  findAllCollaboratorInvites,
} from './admin-collaborator-invites.repository.js'
import { toAdminCollaboratorInviteDetail } from './admin-collaborator-invites.mapper.js'
import type { AdminCollaboratorInviteDetail } from './admin-collaborator-invites.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { ListCollaboratorInvitesInput } from './endpoints/list.js'

export async function listCollaboratorInvites(
  input: ListCollaboratorInvitesInput,
): Promise<ServiceResult<PaginatedResponse<AdminCollaboratorInviteDetail>>> {
  const filters = { inviteStatus: input.inviteStatus }
  const [rows, total] = await Promise.all([
    findAllCollaboratorInvites(input, filters),
    countCollaboratorInvites(filters),
  ])

  const now = new Date()
  return {
    data: buildPaginatedResponse(
      rows.map((row) => toAdminCollaboratorInviteDetail(row, now)),
      input,
      total,
    ),
    httpStatus: HttpStatus.OK,
  }
}
