import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite, buildChanges } from '../../../shared/utils/admin-write.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import {
  updateList,
  softDeleteList,
  restoreList,
} from '../../../db/entities/lists/lists.repository.js'
import {
  findAllListsWithOwner,
  countLists,
  findAdminListById,
  findAdminListByIdWithOwner,
  findListIdsByOwnerUserId,
} from './admin-lists.repository.js'
import { toAdminListDetail } from './admin-lists.mapper.js'
import { AdminAction } from '../admin.enums.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { UpdateListFields } from '../../../db/entities/lists/lists.repository.js'
import type { AdminListDetail } from './admin-lists.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { ListListsInput } from './endpoints/list.js'
import type { UpdateListInput } from './endpoints/update.js'

const FREE_TEXT_FIELDS = new Set(['title', 'description'])

export async function listLists(
  input: ListListsInput,
): Promise<ServiceResult<PaginatedResponse<AdminListDetail>>> {
  const ownerListIds = input.ownerUserId ? await findListIdsByOwnerUserId(input.ownerUserId) : undefined
  if (ownerListIds?.length === 0) {
    return { data: buildPaginatedResponse([], input, 0), httpStatus: HttpStatus.OK }
  }

  const filters = { sort: input.sort, genericFilters: input.genericFilters, ownerListIds }
  const [rows, total] = await Promise.all([findAllListsWithOwner(input, filters), countLists(filters)])

  return {
    data: buildPaginatedResponse(rows.map((row) => toAdminListDetail(row)), input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function getListById(id: string): Promise<ServiceResult<{ list: AdminListDetail }>> {
  const row = await findAdminListByIdWithOwner(id)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  return {
    data: { list: toAdminListDetail(row) },
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

  const fieldPatch: UpdateListFields = pickDefined({
    title: input.title,
    description: input.description,
    listStatus: input.listStatus,
    occasionTypeId: input.occasionTypeId,
  })

  if (Object.keys(fieldPatch).length === 0) {
    return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  }

  const outcome = await runWrite(() => updateList(id, fieldPatch), {
    foreignKeyErrorCode: ErrorCode.UNPROCESSABLE_ENTITY,
  })
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  logChanges(adminId, id, existingRow, fieldPatch)

  const updatedRow = await findAdminListByIdWithOwner(id)
  if (!updatedRow) return serviceError(ErrorCode.INTERNAL_ERROR)

  return {
    data: { list: toAdminListDetail(updatedRow) },
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

  const restored = await restoreList(id)
  if (!restored) return serviceError(ErrorCode.INTERNAL_ERROR)

  logger.info({ adminId, action: AdminAction.RESTORE_LIST, listId: id })

  const restoredRow = await findAdminListByIdWithOwner(id)
  if (!restoredRow) return serviceError(ErrorCode.INTERNAL_ERROR)

  return {
    data: { list: toAdminListDetail(restoredRow) },
    httpStatus: HttpStatus.OK,
  }
}

function logChanges(adminId: string, listId: string, existingRow: List, fieldPatch: UpdateListFields): void {
  const changes = buildChanges(existingRow, fieldPatch, {
    redactFields: FREE_TEXT_FIELDS,
    redactedValue: '<redacted>',
  })
  logger.info({ adminId, action: AdminAction.UPDATE_LIST, listId, changes })
}
