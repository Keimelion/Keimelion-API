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
import type { BaseShop } from '../../../shared/types/shop.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { AdminCreateShopInput } from './endpoints/create.js'
import type { AdminUpdateShopInput } from './endpoints/update.js'
import type { ListShopsInput } from './endpoints/list.js'

export async function createShop(
  adminId: string,
  input: AdminCreateShopInput,
): Promise<ServiceResult<{ shop: BaseShop }>> {
  let createdShop: BaseShop

  try {
    const row = await insertShop({
      slug: input.slug,
      name: input.name,
      domain: input.domain ?? null,
      logoUrl: input.logoUrl ?? null,
      isAffiliated: input.isAffiliated,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    })

    if (!row) {
      return serviceError(ErrorCode.INTERNAL_ERROR)
    }

    createdShop = toBaseShop(row)
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      return serviceError(ErrorCode.CONFLICT)
    }
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  logger.info({
    adminId,
    action: AdminAction.CREATE_SHOP,
    shopId: createdShop.id,
    slug: createdShop.slug,
  })

  return { data: { shop: createdShop }, httpStatus: HttpStatus.CREATED }
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

  const [rows, total] = await Promise.all([
    findAllShops(input, filters),
    countShops(filters),
  ])

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

  if (!existingRow) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  const fieldPatch = pickDefined({
    slug: input.slug,
    name: input.name,
    domain: input.domain,
    logoUrl: input.logoUrl,
    isAffiliated: input.isAffiliated,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  })

  if (Object.keys(fieldPatch).length === 0) {
    logger.info({
      adminId,
      action: AdminAction.UPDATE_SHOP,
      shopId: id,
      slug: existingRow.slug,
      changes: {},
    })
    return { data: { shop: toBaseShop(existingRow) }, httpStatus: HttpStatus.OK }
  }

  const changes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fieldPatch)) {
    changes[key] = { from: existingRow[key as keyof typeof existingRow], to: value }
  }

  let updatedRow: BaseShop | undefined

  try {
    const row = await updateShop(id, fieldPatch)
    if (!row) {
      return serviceError(ErrorCode.INTERNAL_ERROR)
    }
    updatedRow = toBaseShop(row)
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      return serviceError(ErrorCode.CONFLICT)
    }
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  logger.info({
    adminId,
    action: AdminAction.UPDATE_SHOP,
    shopId: id,
    slug: existingRow.slug,
    changes,
  })

  return { data: { shop: updatedRow }, httpStatus: HttpStatus.OK }
}

export async function deleteShopById(
  adminId: string,
  id: string,
): Promise<ServiceResult<null>> {
  const existingRow = await findShopById(id)

  if (!existingRow) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  await deleteShop(id)

  logger.warn({
    adminId,
    action: AdminAction.DELETE_SHOP,
    shopId: id,
    slug: existingRow.slug,
  })

  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}
