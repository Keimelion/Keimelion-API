import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { runWrite, buildChanges } from '../../../shared/utils/admin-write.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import { normalizeTagSlugs } from '../../../shared/utils/slug.js'
import {
  buildListUpdatePatch,
  findListWithOwner,
  updateList,
  softDeleteList,
  restoreList,
} from '../../../db/entities/lists/lists.repository.js'
import { upsertTagsBySlugs } from '../../../db/entities/tags/tags.repository.js'
import {
  deleteListTag,
  insertListTagsIgnoreConflict,
} from '../../../db/entities/list-tags/list-tags.repository.js'
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
  const existingRow = await findAdminListByIdWithOwner(id)
  if (!existingRow || existingRow.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  const fieldPatch = buildListUpdatePatch(input)

  if (Object.keys(fieldPatch).length === 0) {
    return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  }

  const outcome = await runWrite(() => updateList(id, fieldPatch), {
    foreignKeyErrorCode: ErrorCode.UNPROCESSABLE_ENTITY,
  })
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  logChanges(adminId, id, existingRow, fieldPatch)

  const updatedRow = {
    ...outcome.row,
    collaborators: existingRow.collaborators,
    listTags: existingRow.listTags,
  }
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
  const existingRow = await findAdminListByIdWithOwner(id)
  if (!existingRow?.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  const restored = await restoreList(id)
  if (!restored) return serviceError(ErrorCode.INTERNAL_ERROR)

  logger.info({ adminId, action: AdminAction.RESTORE_LIST, listId: id })

  const restoredRow = {
    ...restored,
    collaborators: existingRow.collaborators,
    listTags: existingRow.listTags,
  }
  return {
    data: { list: toAdminListDetail(restoredRow) },
    httpStatus: HttpStatus.OK,
  }
}

export async function assignTagsToList(
  adminId: string,
  listId: string,
  names: string[],
): Promise<ServiceResult<{ list: AdminListDetail }>> {
  const existing = await findAdminListById(listId)
  if (!existing) return serviceError(ErrorCode.NOT_FOUND)

  const slugs = normalizeTagSlugs(names)
  if (slugs === null) return serviceError(ErrorCode.TAG_INVALID_NAME)

  const tagIds = await upsertTagsBySlugs(slugs, null)
  await insertListTagsIgnoreConflict(listId, tagIds)

  const refreshed = await findListWithOwner(listId)
  if (!refreshed) return serviceError(ErrorCode.INTERNAL_ERROR)

  logger.info({ adminId, action: AdminAction.ASSIGN_LIST_TAGS, listId, tagCount: tagIds.length })
  return { data: { list: toAdminListDetail(refreshed) }, httpStatus: HttpStatus.OK }
}

export async function removeTagFromList(
  adminId: string,
  listId: string,
  tagId: string,
): Promise<ServiceResult<null>> {
  const existing = await findAdminListById(listId)
  if (!existing) return serviceError(ErrorCode.NOT_FOUND)

  const removed = await deleteListTag(listId, tagId)
  if (!removed) return serviceError(ErrorCode.TAG_NOT_FOUND)

  logger.info({ adminId, action: AdminAction.REMOVE_LIST_TAG, listId, tagId })
  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}

function logChanges(adminId: string, listId: string, existingRow: List, fieldPatch: UpdateListFields): void {
  const changes = buildChanges(existingRow, fieldPatch, {
    redactFields: FREE_TEXT_FIELDS,
    redactedValue: '<redacted>',
  })
  logger.info({ adminId, action: AdminAction.UPDATE_LIST, listId, changes })
}
