import { db } from '../../../db/client.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite, buildChanges } from '../../../shared/utils/admin-write.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import {
  findItemById,
  insertItem,
  updateItem,
  softDeleteItem,
  restoreItem,
  countListItemsReferencing,
} from '../../../db/entities/items/items.repository.js'
import { findItemSourcesByItemId } from '../../../db/entities/item-sources/item-sources.repository.js'
import { findAllItems, countItems } from './admin-items.repository.js'
import { toAdminItemDetail } from './admin-items.mapper.js'
import { toItemSourceDetail } from '../../../shared/types/item.js'
import { AdminAction } from '../admin.enums.js'
import type { items } from '../../../db/entities/items/items.schema.js'
import type { AdminItemDetail } from './admin-items.mapper.js'
import type { ItemSourceDetail } from '../../../shared/types/item.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { ListItemsInput } from './endpoints/list.js'
import type { CreateItemInput } from './endpoints/create.js'
import type { UpdateItemInput } from './endpoints/update.js'

const URL_FIELDS = new Set(['imageUrl'])

type ItemUpdateFields = Partial<Pick<typeof items.$inferInsert, 'name' | 'description' | 'imageUrl' | 'moderationStatus'>>

export async function createItem(
  adminId: string,
  input: CreateItemInput,
): Promise<ServiceResult<{ item: AdminItemDetail }>> {
  const outcome = await runWrite(() =>
    insertItem({
      name: input.name,
      description: input.description,
      imageUrl: input.imageUrl,
      createdByUserId: null,
      moderationStatus: input.moderationStatus,
    }),
  )

  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const item = toAdminItemDetail(outcome.row)
  logger.info({ adminId, action: AdminAction.CREATE_ITEM, itemId: item.id })
  return { data: { item }, httpStatus: HttpStatus.CREATED }
}

export async function listItems(
  input: ListItemsInput,
): Promise<ServiceResult<PaginatedResponse<AdminItemDetail>>> {
  const [rows, total] = await Promise.all([findAllItems(input, input), countItems(input)])

  return {
    data: buildPaginatedResponse(rows.map(toAdminItemDetail), input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function getItemById(
  id: string,
): Promise<ServiceResult<{ item: AdminItemDetail & { sources: ItemSourceDetail[] } }>> {
  const row = await findItemById(id, { includeDeleted: true })
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  const sources = await findItemSourcesByItemId(id)
  return {
    data: { item: { ...toAdminItemDetail(row), sources: sources.map(toItemSourceDetail) } },
    httpStatus: HttpStatus.OK,
  }
}

export async function updateItemById(
  adminId: string,
  id: string,
  input: UpdateItemInput,
): Promise<ServiceResult<{ item: AdminItemDetail }>> {
  const existingRow = await findItemById(id, { includeDeleted: true })
  if (!existingRow) return serviceError(ErrorCode.NOT_FOUND)

  const fieldPatch: ItemUpdateFields = pickDefined({
    name: input.name,
    description: input.description,
    imageUrl: input.imageUrl,
    moderationStatus: input.moderationStatus,
  })

  if (Object.keys(fieldPatch).length === 0) {
    return serviceError(ErrorCode.UNPROCESSABLE_ENTITY, { message: 'At least one field must be provided' })
  }

  const outcome = await runWrite(() => updateItem(id, fieldPatch))
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const changes = buildChanges(existingRow as unknown as Record<string, unknown>, fieldPatch as Record<string, unknown>, { redactFields: URL_FIELDS, redactedValue: '<url>' })
  logger.info({ adminId, action: AdminAction.UPDATE_ITEM, itemId: id, changes })
  return { data: { item: toAdminItemDetail(outcome.row) }, httpStatus: HttpStatus.OK }
}

export async function deleteItemById(
  adminId: string,
  id: string,
): Promise<ServiceResult<{ item: AdminItemDetail }>> {
  return db.transaction(async (tx) => {
    const refCount = await countListItemsReferencing(id, tx)
    if (refCount > 0) {
      return serviceError(ErrorCode.CONFLICT, { message: `Item referenced by ${String(refCount)} list_items` })
    }

    const row = await softDeleteItem(id, tx)
    if (!row) return serviceError(ErrorCode.NOT_FOUND)

    logger.warn({ adminId, action: AdminAction.DELETE_ITEM, itemId: id })
    return { data: { item: toAdminItemDetail(row) }, httpStatus: HttpStatus.OK }
  })
}

export async function restoreItemById(
  adminId: string,
  id: string,
): Promise<ServiceResult<{ item: AdminItemDetail }>> {
  const existingRow = await findItemById(id, { includeDeleted: true })
  if (!existingRow?.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  const row = await restoreItem(id)
  if (!row) return serviceError(ErrorCode.INTERNAL_ERROR)

  logger.info({ adminId, action: AdminAction.RESTORE_ITEM, itemId: id })
  return { data: { item: toAdminItemDetail(row) }, httpStatus: HttpStatus.OK }
}
