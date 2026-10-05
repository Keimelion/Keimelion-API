import { db } from '../../../db/client.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite } from '../../../shared/utils/admin-write.js'
import { findItemById } from '../../../db/entities/items/items.repository.js'
import {
  findItemSourceById,
  findItemSourceByIdWithShop,
  insertItemSource,
  updateItemSource,
  deleteItemSource,
  countItemSourcesByItemId,
  existsItemSourceForShop,
} from '../../../db/entities/item-sources/item-sources.repository.js'
import { findShopById } from '../../../db/entities/shops/shops.repository.js'
import { toItemSourceDetail } from '../../../shared/types/item.js'
import { AdminAction } from '../admin.enums.js'
import type { Shop } from '../../../db/entities/shops/shops.schema.js'
import type { ItemSourceDetail } from '../../../shared/types/item.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { CreateItemSourceInput } from './endpoints/create-source.js'
import type { UpdateItemSourceInput } from './endpoints/update-source.js'

export async function createItemSource(
  adminId: string,
  itemId: string,
  input: CreateItemSourceInput,
): Promise<ServiceResult<{ source: ItemSourceDetail }>> {
  const item = await findItemById(itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)

  let shop: Shop | null = null
  if (input.shopId !== null) {
    const found = await findShopById(input.shopId)
    if (!found?.isActive) return serviceError(ErrorCode.NOT_FOUND)
    shop = found

    const alreadyUsed = await existsItemSourceForShop(itemId, input.shopId)
    if (alreadyUsed) return serviceError(ErrorCode.DUPLICATE_SHOP_FOR_ITEM)
  }

  const outcome = await runWrite(() =>
    insertItemSource({
      itemId,
      shopId: input.shopId,
      sourceUrl: input.sourceUrl,
      price: input.price,
      currency: input.currency,
    }),
  )
  if ('errorCode' in outcome) {
    if (outcome.errorCode === ErrorCode.CONFLICT) return serviceError(ErrorCode.DUPLICATE_SHOP_FOR_ITEM)
    return serviceError(outcome.errorCode)
  }

  const source = toItemSourceDetail({ ...outcome.row, shop })
  logger.info({ adminId, action: AdminAction.CREATE_ITEM_SOURCE, itemId, sourceId: source.id })
  return { data: { source }, httpStatus: HttpStatus.CREATED }
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

    if (input.shopId !== existingSource.shopId) {
      const alreadyUsed = await existsItemSourceForShop(itemId, input.shopId, sourceId)
      if (alreadyUsed) return serviceError(ErrorCode.DUPLICATE_SHOP_FOR_ITEM)
    }
  }

  const fields = pickDefined({
    shopId: input.shopId,
    sourceUrl: input.sourceUrl,
    price: input.price,
    currency: input.currency,
  })

  const outcome = await runWrite(() => updateItemSource(sourceId, fields))
  if ('errorCode' in outcome) {
    if (outcome.errorCode === ErrorCode.CONFLICT) return serviceError(ErrorCode.DUPLICATE_SHOP_FOR_ITEM)
    return serviceError(outcome.errorCode)
  }

  const updatedSource = await findItemSourceByIdWithShop(sourceId)
  if (!updatedSource) return serviceError(ErrorCode.INTERNAL_ERROR)

  logger.info({ adminId, action: AdminAction.UPDATE_ITEM_SOURCE, itemId, sourceId })
  return { data: { source: toItemSourceDetail(updatedSource) }, httpStatus: HttpStatus.OK }
}

export async function deleteItemSourceById(
  adminId: string,
  itemId: string,
  sourceId: string,
): Promise<ServiceResult<{ message: string }>> {
  const existingSource = await findItemSourceById(sourceId)
  if (existingSource?.itemId !== itemId) return serviceError(ErrorCode.NOT_FOUND)

  const outcome = await db.transaction(async (tx) => {
    const remaining = await countItemSourcesByItemId(itemId, tx)
    if (remaining <= 1) {
      return serviceError(ErrorCode.CONFLICT, { message: 'Cannot remove the last source of an item' })
    }

    await deleteItemSource(sourceId, tx)
    return null
  })

  if (outcome !== null) return outcome

  logger.warn({ adminId, action: AdminAction.DELETE_ITEM_SOURCE, itemId, sourceId })
  return { data: { message: 'Item source deleted successfully' }, httpStatus: HttpStatus.OK }
}
