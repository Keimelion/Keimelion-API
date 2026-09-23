import { db } from '../../../db/client.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { isPgUniqueViolation } from '../../../shared/db/pg-errors.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import {
  findItemById,
  insertItem,
  updateItem,
  softDeleteItem,
  restoreItem,
  countListItemsReferencing,
} from '../../../db/entities/items/items.repository.js'
import {
  findItemSourceById,
  findItemSourcesByItemId,
  insertItemSource,
  updateItemSource,
  deleteItemSource,
  demotePrimaryItemSource,
  setPrimaryItemSource,
} from '../../../db/entities/item-sources/item-sources.repository.js'
import { findShopById } from '../../../db/entities/shops/shops.repository.js'
import { findAllItems, countItems } from './admin-items.repository.js'
import { toAdminItemDetail } from './admin-items.mapper.js'
import { toItemSourceDetail } from '../../../shared/types/item.js'
import { AdminAction } from '../admin.enums.js'
import type { items } from '../../../db/entities/items/items.schema.js'
import type { Item } from '../../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { AdminItemDetail } from './admin-items.mapper.js'
import type { ItemSourceDetail } from '../../../shared/types/item.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { ListItemsInput } from './endpoints/list.js'
import type { CreateItemInput } from './endpoints/create.js'
import type { UpdateItemInput } from './endpoints/update.js'
import type { CreateItemSourceInput } from './endpoints/create-source.js'
import type { UpdateItemSourceInput } from './endpoints/update-source.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const URL_FIELDS = new Set(['imageUrl', 'sourceUrl'])

type ItemUpdateFields = Partial<Pick<typeof items.$inferInsert, 'name' | 'description' | 'imageUrl' | 'moderationStatus'>>

type WriteOutcome = { row: Item } | { errorCode: ErrorCode }
type SourceWriteOutcome = { row: ItemSource } | { errorCode: ErrorCode }

async function runItemWrite(op: () => Promise<Item | undefined>): Promise<WriteOutcome> {
  try {
    const row = await op()
    if (!row) return { errorCode: ErrorCode.INTERNAL_ERROR }
    return { row }
  } catch (error) {
    if (isPgUniqueViolation(error)) return { errorCode: ErrorCode.CONFLICT }
    return { errorCode: ErrorCode.INTERNAL_ERROR }
  }
}

async function runSourceWrite(op: () => Promise<ItemSource | undefined>): Promise<SourceWriteOutcome> {
  try {
    const row = await op()
    if (!row) return { errorCode: ErrorCode.INTERNAL_ERROR }
    return { row }
  } catch (error) {
    if (isPgUniqueViolation(error)) return { errorCode: ErrorCode.CONFLICT }
    return { errorCode: ErrorCode.INTERNAL_ERROR }
  }
}

function buildItemChanges(
  existing: Item,
  patch: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const [key, value] of Object.entries(patch)) {
    const fromValue = URL_FIELDS.has(key) ? '<url>' : existing[key as keyof Item]
    changes[key] = { from: fromValue, to: URL_FIELDS.has(key) ? '<url>' : value }
  }
  return changes
}

export async function createItem(
  adminId: string,
  input: CreateItemInput,
): Promise<ServiceResult<{ item: AdminItemDetail }>> {
  const outcome = await runItemWrite(() =>
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

  const outcome = await runItemWrite(() => updateItem(id, fieldPatch))
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const changes = buildItemChanges(existingRow, fieldPatch as Record<string, unknown>)
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

export async function listItemSources(
  itemId: string,
): Promise<ServiceResult<{ sources: ItemSourceDetail[] }>> {
  const item = await findItemById(itemId, { includeDeleted: true })
  if (!item) return serviceError(ErrorCode.NOT_FOUND)

  const sources = await findItemSourcesByItemId(itemId)
  return {
    data: { sources: sources.map(toItemSourceDetail) },
    httpStatus: HttpStatus.OK,
  }
}

export async function createItemSource(
  adminId: string,
  itemId: string,
  input: CreateItemSourceInput,
): Promise<ServiceResult<{ source: ItemSourceDetail }>> {
  const item = await findItemById(itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)

  if (input.shopId !== null) {
    const shop = await findShopById(input.shopId)
    if (!shop?.isActive) return serviceError(ErrorCode.NOT_FOUND)
  }

  const outcome = await db.transaction((tx) => createSourceInTransaction(tx, itemId, input))
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const source = toItemSourceDetail(outcome.row)
  logger.info({ adminId, action: AdminAction.CREATE_ITEM_SOURCE, itemId, sourceId: source.id })
  return { data: { source }, httpStatus: HttpStatus.CREATED }
}

async function createSourceInTransaction(
  tx: DbTransaction,
  itemId: string,
  input: CreateItemSourceInput,
): Promise<SourceWriteOutcome> {
  if (input.isPrimary) {
    await demotePrimaryItemSource(itemId, tx)
  }

  return runSourceWrite(() =>
    insertItemSource(
      {
        itemId,
        shopId: input.shopId,
        sourceUrl: input.sourceUrl,
        price: input.price,
        currency: input.currency,
        isPrimary: input.isPrimary,
      },
      tx,
    ),
  )
}

export async function updateItemSourceById(
  adminId: string,
  itemId: string,
  sourceId: string,
  input: UpdateItemSourceInput,
): Promise<ServiceResult<{ source: ItemSourceDetail }>> {
  const existingSource = await findItemSourceById(sourceId)
  if (existingSource?.itemId !== itemId) return serviceError(ErrorCode.NOT_FOUND)

  if (input.shopId !== null && input.shopId !== undefined) {
    const shop = await findShopById(input.shopId)
    if (!shop?.isActive) return serviceError(ErrorCode.NOT_FOUND)
  }

  const outcome = await db.transaction((tx) => updateSourceInTransaction(tx, itemId, sourceId, input))
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  logger.info({ adminId, action: AdminAction.UPDATE_ITEM_SOURCE, itemId, sourceId })
  return { data: { source: toItemSourceDetail(outcome.row) }, httpStatus: HttpStatus.OK }
}

async function updateSourceInTransaction(
  tx: DbTransaction,
  itemId: string,
  sourceId: string,
  input: UpdateItemSourceInput,
): Promise<SourceWriteOutcome> {
  if (input.isPrimary === true) {
    await setPrimaryItemSource(itemId, sourceId, tx)
  }

  const fields = pickDefined({
    shopId: input.shopId,
    sourceUrl: input.sourceUrl,
    price: input.price,
    currency: input.currency,
    isPrimary: input.isPrimary,
  })

  return runSourceWrite(() => updateItemSource(sourceId, fields, tx))
}

export async function deleteItemSourceById(
  adminId: string,
  itemId: string,
  sourceId: string,
): Promise<ServiceResult<{ message: string }>> {
  const existingSource = await findItemSourceById(sourceId)
  if (existingSource?.itemId !== itemId) return serviceError(ErrorCode.NOT_FOUND)

  await deleteItemSource(sourceId)

  logger.warn({ adminId, action: AdminAction.DELETE_ITEM_SOURCE, itemId, sourceId })
  return { data: { message: 'Item source deleted successfully' }, httpStatus: HttpStatus.OK }
}
