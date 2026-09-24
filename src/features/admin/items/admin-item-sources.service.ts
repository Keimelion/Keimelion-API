import { db } from '../../../db/client.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite, type WriteOutcome } from '../../../shared/utils/admin-write.js'
import { findItemById } from '../../../db/entities/items/items.repository.js'
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
import { toItemSourceDetail } from '../../../shared/types/item.js'
import { AdminAction } from '../admin.enums.js'
import type { ItemSource } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { ItemSourceDetail } from '../../../shared/types/item.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { CreateItemSourceInput } from './endpoints/create-source.js'
import type { UpdateItemSourceInput } from './endpoints/update-source.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

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
): Promise<WriteOutcome<ItemSource>> {
  if (input.isPrimary) {
    await demotePrimaryItemSource(itemId, tx)
  }

  return runWrite(() =>
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
): Promise<WriteOutcome<ItemSource>> {
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

  return runWrite(() => updateItemSource(sourceId, fields, tx))
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
