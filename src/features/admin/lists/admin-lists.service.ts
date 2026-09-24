import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite, buildChanges } from '../../../shared/utils/admin-write.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import { toUserDetail } from '../../../shared/types/user.js'
import {
  updateList,
  softDeleteList,
  restoreList,
} from '../../../db/entities/lists/lists.repository.js'
import {
  findAllLists,
  countLists,
  findAdminListById,
  findListIdsByOwnerUserId,
  findOwnersByListIds,
} from './admin-lists.repository.js'
import { toAdminListDetail } from './admin-lists.mapper.js'
import { AdminAction } from '../admin.enums.js'
import type { lists } from '../../../db/entities/lists/lists.schema.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { User } from '../../../db/entities/users/users.schema.js'
import type { UserDetail } from '../../../shared/types/user.js'
import type { AdminListDetail } from './admin-lists.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { ListListsInput } from './endpoints/list.js'
import type { UpdateListInput } from './endpoints/update.js'

const FREE_TEXT_FIELDS = new Set(['title', 'description'])

type ListUpdateFields = Partial<
  Pick<typeof lists.$inferInsert, 'title' | 'description' | 'listStatus' | 'occasionTypeId'>
>

export async function listLists(
  input: ListListsInput,
): Promise<ServiceResult<PaginatedResponse<AdminListDetail>>> {
  const ownerListIds = input.ownerUserId ? await findListIdsByOwnerUserId(input.ownerUserId) : undefined
  if (ownerListIds?.length === 0) {
    return { data: buildPaginatedResponse([], input, 0), httpStatus: HttpStatus.OK }
  }

  const filters = { sort: input.sort, genericFilters: input.genericFilters, ownerListIds }
  const [rows, total] = await Promise.all([findAllLists(input, filters), countLists(filters)])
  const ownersMap = await findOwnersByListIds(rows.map((row) => row.id))

  return {
    data: buildPaginatedResponse(
      rows.map((row) => toAdminListDetail(row, resolveOwnerDetail(ownersMap, row.id))),
      input,
      total,
    ),
    httpStatus: HttpStatus.OK,
  }
}

export async function getListById(id: string): Promise<ServiceResult<{ list: AdminListDetail }>> {
  const row = await findAdminListById(id)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  const ownersMap = await findOwnersByListIds([id])
  return {
    data: { list: toAdminListDetail(row, resolveOwnerDetail(ownersMap, id)) },
    httpStatus: HttpStatus.OK,
  }
}

export async function updateListById(
  adminId: string,
  id: string,
  input: UpdateListInput,
): Promise<ServiceResult<{ list: AdminListDetail }>> {
  const existingRow = await findAdminListById(id)
  if (!existingRow || existingRow.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  const fieldPatch: ListUpdateFields = pickDefined({
    title: input.title,
    description: input.description,
    listStatus: input.listStatus,
    occasionTypeId: input.occasionTypeId,
  })

  if (Object.keys(fieldPatch).length === 0) {
    return serviceError(ErrorCode.UNPROCESSABLE_ENTITY, { message: 'At least one field must be provided' })
  }

  const outcome = await runWrite(() => updateList(id, fieldPatch), {
    foreignKeyErrorCode: ErrorCode.UNPROCESSABLE_ENTITY,
  })
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  logChanges(adminId, id, existingRow, fieldPatch)

  const ownersMap = await findOwnersByListIds([id])
  return {
    data: { list: toAdminListDetail(outcome.row, resolveOwnerDetail(ownersMap, id)) },
    httpStatus: HttpStatus.OK,
  }
}

export async function deleteListById(adminId: string, id: string): Promise<ServiceResult<null>> {
  const existingRow = await findAdminListById(id)
  if (!existingRow || existingRow.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  await softDeleteList(id)

  logger.warn({ adminId, action: AdminAction.DELETE_LIST, listId: id })
  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}

export async function restoreListById(
  adminId: string,
  id: string,
): Promise<ServiceResult<{ list: AdminListDetail }>> {
  const existingRow = await findAdminListById(id)
  if (!existingRow?.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  const row = await restoreList(id)
  if (!row) return serviceError(ErrorCode.INTERNAL_ERROR)

  logger.info({ adminId, action: AdminAction.RESTORE_LIST, listId: id })

  const ownersMap = await findOwnersByListIds([id])
  return {
    data: { list: toAdminListDetail(row, resolveOwnerDetail(ownersMap, id)) },
    httpStatus: HttpStatus.OK,
  }
}

function resolveOwnerDetail(ownersMap: Map<string, User>, listId: string): UserDetail | null {
  const owner = ownersMap.get(listId)
  return owner ? toUserDetail(owner) : null
}

function logChanges(adminId: string, listId: string, existingRow: List, fieldPatch: ListUpdateFields): void {
  const changes = buildChanges(
    existingRow as unknown as Record<string, unknown>,
    fieldPatch as Record<string, unknown>,
    { redactFields: FREE_TEXT_FIELDS, redactedValue: '<redacted>' },
  )
  logger.info({ adminId, action: AdminAction.UPDATE_LIST, listId, changes })
}
