import { db } from '../../../db/client.js'
import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
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
import { resolveSourceShop } from '../../../shared/db/source-shops.js'
import { toItemSourceDetail } from '../../../shared/types/item.js'
import { AdminAction } from '../admin.enums.js'
import type { Shop } from '../../../db/entities/shops/shops.schema.js'
import type { ItemSourceDetail } from '../../../shared/types/item.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type {
  AdminItemsCreateSourceRequestParsed,
  AdminItemsUpdateSourceRequestParsed,
} from '@keimelion/sdk/schemas'

type ShopSelection = { shop: Shop | null } | { errorCode: ErrorCode }
type ShopIdSelection = { shopId: string | null | undefined } | { errorCode: ErrorCode }

export async function createItemSource(
  adminId: string,
  itemId: string,
  input: AdminItemsCreateSourceRequestParsed,
): Promise<ServiceResult<{ source: ItemSourceDetail }>> {
  const item = await findItemById(itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)

  const selection = await selectCreateSourceShop(input)
  if ('errorCode' in selection) return serviceError(selection.errorCode)
  const { shop } = selection

  if (shop !== null && (await existsItemSourceForShop(itemId, shop.id))) {
    return serviceError(ErrorCode.DUPLICATE_SHOP_FOR_ITEM)
  }

  const outcome = await runWrite(() =>
    insertItemSource({
      itemId,
      shopId: shop?.id ?? null,
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
  input: AdminItemsUpdateSourceRequestParsed,
): Promise<ServiceResult<{ source: ItemSourceDetail }>> {
  const existingSource = await findItemSourceById(sourceId)
  if (existingSource?.itemId !== itemId) return serviceError(ErrorCode.NOT_FOUND)

  const selection = await selectUpdateSourceShopId(input)
  if ('errorCode' in selection) return serviceError(selection.errorCode)
  const { shopId } = selection

  if (shopId !== null && shopId !== undefined && shopId !== existingSource.shopId) {
    const alreadyUsed = await existsItemSourceForShop(itemId, shopId, sourceId)
    if (alreadyUsed) return serviceError(ErrorCode.DUPLICATE_SHOP_FOR_ITEM)
  }

  const fields = pickDefined({
    shopId,
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

async function selectCreateSourceShop(input: AdminItemsCreateSourceRequestParsed): Promise<ShopSelection> {
  if (input.shopId === null) return { shop: await resolveSourceShop(input.sourceUrl) }

  const shop = await findShopById(input.shopId)
  if (!shop?.isActive) return { errorCode: ErrorCode.NOT_FOUND }
  return { shop }
}

async function selectUpdateSourceShopId(input: AdminItemsUpdateSourceRequestParsed): Promise<ShopIdSelection> {
  if (input.shopId === null) return { shopId: null }
  if (input.shopId !== undefined) {
    const shop = await findShopById(input.shopId)
    if (!shop?.isActive) return { errorCode: ErrorCode.NOT_FOUND }
    return { shopId: shop.id }
  }
  if (input.sourceUrl === undefined) return { shopId: undefined }

  const resolvedShop = await resolveSourceShop(input.sourceUrl)
  return { shopId: resolvedShop?.id ?? null }
}
