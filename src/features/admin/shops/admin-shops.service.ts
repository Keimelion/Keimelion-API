import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { isPgUniqueViolation } from '../../../shared/db/pg-errors.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import {
  findShopById,
  insertShop,
  updateShop,
  deleteShop,
} from '../../../db/entities/shops/shops.repository.js'
import { findAllShops, countShops } from './admin-shops.repository.js'
import { toBaseShop } from '../../shops/shops.mapper.js'
import { AdminAction } from '../admin.enums.js'
import type { Shop } from '../../../db/entities/shops/shops.schema.js'
import type { BaseShop } from '../../../shared/types/shop.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { AdminCreateShopInput } from './endpoints/create.js'
import type { AdminUpdateShopInput } from './endpoints/update.js'
import type { ListShopsInput } from './endpoints/list.js'

type ShopFieldPatch = Partial<Omit<BaseShop, 'id' | 'createdAt' | 'updatedAt'>>

type WriteOutcome = { row: Shop } | { errorCode: ErrorCode }

async function runShopWrite(op: () => Promise<Shop | undefined>): Promise<WriteOutcome> {
  try {
    const row = await op()
    if (!row) return { errorCode: ErrorCode.INTERNAL_ERROR }
    return { row }
  } catch (error) {
    if (isPgUniqueViolation(error)) return { errorCode: ErrorCode.CONFLICT }
    return { errorCode: ErrorCode.INTERNAL_ERROR }
  }
}

function buildShopChanges(
  existing: Shop,
  patch: ShopFieldPatch,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const [key, value] of Object.entries(patch)) {
    changes[key] = { from: existing[key as keyof Shop], to: value }
  }
  return changes
}

export async function createShop(
  adminId: string,
  input: AdminCreateShopInput,
): Promise<ServiceResult<{ shop: BaseShop }>> {
  const outcome = await runShopWrite(() =>
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

  const shop = toBaseShop(outcome.row)
  logger.info({ adminId, action: AdminAction.CREATE_SHOP, shopId: shop.id, slug: shop.slug })
  return { data: { shop }, httpStatus: HttpStatus.CREATED }
}

export async function listShops(
  input: ListShopsInput,
): Promise<ServiceResult<PaginatedResponse<BaseShop>>> {
  const filters = {
    search: input.search,
    isActive: input.isActive,
    isAffiliated: input.isAffiliated,
    hasDomain: input.hasDomain,
    sort: input.sort,
  }

  const [rows, total] = await Promise.all([findAllShops(input, filters), countShops(filters)])

  return {
    data: buildPaginatedResponse(rows.map(toBaseShop), input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function updateShopById(
  adminId: string,
  id: string,
  input: AdminUpdateShopInput,
): Promise<ServiceResult<{ shop: BaseShop }>> {
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
    return { data: { shop: toBaseShop(existingRow) }, httpStatus: HttpStatus.OK }
  }

  const outcome = await runShopWrite(() => updateShop(id, fieldPatch))
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  logger.info({ ...logBase, changes: buildShopChanges(existingRow, fieldPatch) })
  return { data: { shop: toBaseShop(outcome.row) }, httpStatus: HttpStatus.OK }
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
