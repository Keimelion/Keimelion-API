import { db } from '../../../db/client.js'
import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite } from '../../../shared/utils/admin-write.js'
import {
  findItemSourceById,
  findItemSourceByIdWithShop,
  insertItemSource,
  updateItemSource,
  deleteItemSource,
  countItemSourcesByItemId,
} from '../../../db/entities/item-sources/item-sources.repository.js'
import { resolveSourceShop } from '../../../shared/db/source-shops.js'
import { buildSourceUrlFields } from '../../affiliate/affiliate.service.js'
import { toItemSourceDetail } from '../../../shared/types/item.js'
import { AdminAction } from '../admin.enums.js'
import { ITEM_SOURCES_ITEM_SHOP_UNIQUE_INDEX } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { ItemSource } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { ItemSourceDetail } from '../../../shared/types/item.js'
import type { Shop } from '../../../db/entities/shops/shops.schema.js'
import type { SourceUrlFields } from '../../affiliate/affiliate.service.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type {
  AdminItemsCreateSourceRequestParsed,
  AdminItemsUpdateSourceRequestParsed,
} from '@keimelion/sdk/schemas'

interface SourceShopAndUrlPatch extends Partial<SourceUrlFields> {
  shopId?: string | null | undefined
}

// A missing item or shop surfaces as a FK violation, a second source on the same shop as a unique violation.
// A URL already held by another source falls back to CONFLICT.
const SOURCE_WRITE_ERRORS = {
  uniqueErrorCodeByConstraint: { [ITEM_SOURCES_ITEM_SHOP_UNIQUE_INDEX]: ErrorCode.DUPLICATE_SHOP_FOR_ITEM },
  foreignKeyErrorCode: ErrorCode.NOT_FOUND,
}

export async function createItemSource(
  adminId: string,
  itemId: string,
  input: AdminItemsCreateSourceRequestParsed,
): Promise<ServiceResult<{ source: ItemSourceDetail }>> {
  const shop = await resolveSourceShop(input)

  const outcome = await runWrite(
    () =>
      insertItemSource({
        itemId,
        shopId: input.shopId ?? shop?.id ?? null,
        ...buildSourceUrlFields(input.sourceUrl, shop?.slug ?? null),
        price: input.price,
        currency: input.currency,
        createdByUserId: null,
      }),
    SOURCE_WRITE_ERRORS,
  )
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const source = await findItemSourceByIdWithShop(outcome.row.id)
  if (!source) return serviceError(ErrorCode.INTERNAL_ERROR)

  logger.info({ adminId, action: AdminAction.CREATE_ITEM_SOURCE, itemId, sourceId: source.id })
  return { data: { source: toItemSourceDetail(source) }, httpStatus: HttpStatus.CREATED }
}

export async function updateItemSourceById(
  adminId: string,
  itemId: string,
  sourceId: string,
  input: AdminItemsUpdateSourceRequestParsed,
): Promise<ServiceResult<{ source: ItemSourceDetail }>> {
  const existingSource = await findItemSourceById(sourceId)
  if (existingSource?.itemId !== itemId) return serviceError(ErrorCode.NOT_FOUND)

  const fields = pickDefined({
    ...(await buildShopAndUrlPatch(existingSource, input)),
    price: input.price,
    currency: input.currency,
  })

  const outcome = await runWrite(() => updateItemSource(sourceId, fields), SOURCE_WRITE_ERRORS)
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

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

// An explicit shopId always wins. A new URL only fills in a missing shop, so a shop already set is never
// overwritten. Any URL or shop change normalizes the submitted URL again with the resulting shop's strategy.
async function buildShopAndUrlPatch(
  existingSource: ItemSource,
  input: AdminItemsUpdateSourceRequestParsed,
): Promise<SourceShopAndUrlPatch> {
  if (input.shopId === undefined && input.sourceUrl === undefined) return {}

  const submittedUrl = input.sourceUrl === undefined ? existingSource.originalUrl ?? existingSource.sourceUrl : input.sourceUrl
  const shop =
    input.shopId === null
      ? null
      : await resolveSourceShop({ shopId: input.shopId ?? existingSource.shopId, sourceUrl: submittedUrl })

  return {
    shopId: selectShopIdPatch(existingSource, input, shop),
    ...buildSourceUrlFields(submittedUrl, shop?.slug ?? null),
  }
}

function selectShopIdPatch(
  existingSource: ItemSource,
  input: AdminItemsUpdateSourceRequestParsed,
  resolvedShop: Shop | null,
): string | null | undefined {
  if (input.shopId !== undefined) return input.shopId
  if (existingSource.shopId !== null) return undefined
  return resolvedShop?.id
}
