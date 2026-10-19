import { db } from '../../../db/client.js'
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
import { replaceListTags } from '../../../db/entities/list-tags/list-tags.repository.js'
import {
  findAllListsWithOwner,
  countLists,
  findAdminListById,
  findAdminListByIdWithOwner,
  findListAggregatesByIds,
  findListIdsByOwnerUserId,
} from './admin-lists.repository.js'
import {
  countListItemsByListId,
  findListItemsByListIdPaged,
} from './admin-list-items.repository.js'
import { toAdminListDetail } from './admin-lists.mapper.js'
import { toAdminListItemResponse } from './admin-list-items.mapper.js'
import { AdminAction } from '../admin.enums.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { UpdateListFields } from '../../../db/entities/lists/lists.repository.js'
import type { AdminListAggregate, AdminListDetail } from './admin-lists.mapper.js'
import type { AdminListItemResponse } from './admin-list-items.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
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

  const aggregates = await buildAggregateMap(rows.map((row) => row.id))

  return {
    data: buildPaginatedResponse(
      rows.map((row) => toAdminListDetail(row, aggregates.get(row.id))),
      input,
      total,
    ),
    httpStatus: HttpStatus.OK,
  }
}

export async function getListById(id: string): Promise<ServiceResult<{ list: AdminListDetail }>> {
  const row = await findAdminListByIdWithOwner(id)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  const aggregates = await buildAggregateMap([row.id])

  return {
    data: { list: toAdminListDetail(row, aggregates.get(row.id)) },
    httpStatus: HttpStatus.OK,
  }
}

export async function listListItemsByListId(
  id: string,
  pagination: PaginationInput,
): Promise<ServiceResult<PaginatedResponse<AdminListItemResponse>>> {
  const list = await findAdminListById(id)
  if (!list || list.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  const [rows, total] = await Promise.all([
    findListItemsByListIdPaged(id, pagination),
    countListItemsByListId(id),
  ])

  return {
    data: buildPaginatedResponse(rows.map(toAdminListItemResponse), pagination, total),
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
  const { tags } = input

  if (Object.keys(fieldPatch).length === 0 && tags === undefined) {
    return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  }

  let tagSlugs: string[] | null = null
  if (tags !== undefined) {
    tagSlugs = normalizeTagSlugs(tags)
    if (tagSlugs === null) return serviceError(ErrorCode.TAG_INVALID_NAME)
  }

  const outcome = await runWrite(
    () =>
      db.transaction(async (tx) => {
        const updated =
          Object.keys(fieldPatch).length > 0
            ? await updateList(id, fieldPatch, tx)
            : existingRow
        if (tagSlugs !== null) {
          const tagIds = await upsertTagsBySlugs(tagSlugs, null, tx)
          await replaceListTags(id, tagIds, tx)
        }
        return updated
      }),
    { foreignKeyErrorCode: ErrorCode.UNPROCESSABLE_ENTITY },
  )
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  logChanges(adminId, id, existingRow, fieldPatch)

  const aggregates = await buildAggregateMap([id])

  if (tagSlugs === null) {
    const updatedRow = {
      ...outcome.row,
      collaborators: existingRow.collaborators,
      listTags: existingRow.listTags,
    }
    return {
      data: { list: toAdminListDetail(updatedRow, aggregates.get(id)) },
      httpStatus: HttpStatus.OK,
    }
  }

  const refreshed = await findListWithOwner(id)
  if (!refreshed) return serviceError(ErrorCode.INTERNAL_ERROR)
  return {
    data: { list: toAdminListDetail(refreshed, aggregates.get(id)) },
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

  const aggregates = await buildAggregateMap([id])

  const restoredRow = {
    ...restored,
    collaborators: existingRow.collaborators,
    listTags: existingRow.listTags,
  }
  return {
    data: { list: toAdminListDetail(restoredRow, aggregates.get(id)) },
    httpStatus: HttpStatus.OK,
  }
}

async function buildAggregateMap(listIds: string[]): Promise<Map<string, AdminListAggregate>> {
  const rows = await findListAggregatesByIds(listIds)
  return new Map(
    rows.map((row) => [
      row.listId,
      { itemCount: row.itemCount, totalEstimatedPrice: row.totalEstimatedPrice },
    ]),
  )
}

function logChanges(adminId: string, listId: string, existingRow: List, fieldPatch: UpdateListFields): void {
  const changes = buildChanges(existingRow, fieldPatch, {
    redactFields: FREE_TEXT_FIELDS,
    redactedValue: '<redacted>',
  })
  logger.info({ adminId, action: AdminAction.UPDATE_LIST, listId, changes })
}
