import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite, buildChanges } from '../../../shared/utils/admin-write.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import {
  findShopById,
  insertShop,
  updateShop,
  deleteShop,
} from '../../../db/entities/shops/shops.repository.js'
import { findAllShops, countShops } from './admin-shops.repository.js'
import { toShopDetail } from '../../../shared/types/shop.js'
import { AdminAction } from '../admin.enums.js'
import type { ShopDetail, ShopWrite } from '../../../shared/types/shop.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse, PartialWrite } from '../../../shared/types/api.js'
import type { ListShopsInput } from './endpoints/list.js'

type ShopFieldPatch = Partial<ShopWrite>

export async function createShop(
  adminId: string,
  input: ShopWrite,
): Promise<ServiceResult<{ shop: ShopDetail }>> {
  const outcome = await runWrite(() =>
    insertShop({
      slug: input.slug,
      name: input.name,
      domain: input.domain ?? null,
      logoUrl: input.logoUrl ?? null,
      isAffiliated: input.isAffiliated,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    }),
  )

  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const shop = toShopDetail(outcome.row)
  logger.info({ adminId, action: AdminAction.CREATE_SHOP, shopId: shop.id, slug: shop.slug })
  return { data: { shop }, httpStatus: HttpStatus.CREATED }
}

export async function listShops(
  input: ListShopsInput,
): Promise<ServiceResult<PaginatedResponse<ShopDetail>>> {
  const [rows, total] = await Promise.all([findAllShops(input, input), countShops(input)])

  return {
    data: buildPaginatedResponse(rows.map(toShopDetail), input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function updateShopById(
  adminId: string,
  id: string,
  input: PartialWrite<ShopWrite>,
): Promise<ServiceResult<{ shop: ShopDetail }>> {
  const existingRow = await findShopById(id)
  if (!existingRow) return serviceError(ErrorCode.NOT_FOUND)

  const fieldPatch: ShopFieldPatch = pickDefined({
    slug: input.slug,
    name: input.name,
    domain: input.domain,
    logoUrl: input.logoUrl,
    isAffiliated: input.isAffiliated,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  })

  const logBase = { adminId, action: AdminAction.UPDATE_SHOP, shopId: id, slug: existingRow.slug }

  if (Object.keys(fieldPatch).length === 0) {
    logger.info({ ...logBase, changes: {} })
    return { data: { shop: toShopDetail(existingRow) }, httpStatus: HttpStatus.OK }
  }

  const outcome = await runWrite(() => updateShop(id, fieldPatch))
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  logger.info({ ...logBase, changes: buildChanges(existingRow, fieldPatch) })
  return { data: { shop: toShopDetail(outcome.row) }, httpStatus: HttpStatus.OK }
}

export async function deleteShopById(
  adminId: string,
  id: string,
): Promise<ServiceResult<null>> {
  const existingRow = await findShopById(id)
  if (!existingRow) return serviceError(ErrorCode.NOT_FOUND)

  await deleteShop(id)

  logger.warn({
    adminId,
    action: AdminAction.DELETE_SHOP,
    shopId: id,
    slug: existingRow.slug,
  })

  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}
