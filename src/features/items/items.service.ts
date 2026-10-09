import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { buildPaginatedResponse } from '../../shared/schemas/pagination.js'
import {
  countAllItems,
  findAllItemsWithSources,
  findItemById,
  findItemByIdWithSources,
} from '../../db/entities/items/items.repository.js'
import { findCategoriesByIds } from '../../db/entities/categories/categories.repository.js'
import { replaceItemCategories } from '../../db/entities/item-categories/item-categories.repository.js'
import { toItemWithSources } from '../../shared/types/item.js'
import { toCategoryPublic } from '../../shared/types/category.js'
import type { ItemWithSources } from '../../shared/types/item.js'
import type { CategoryPublic } from '../../shared/types/category.js'
import type { PaginationInput } from '../../shared/schemas/pagination.js'
import type { PaginatedResponse } from '../../shared/types/api.js'
import type { ServiceResult } from '../../shared/types/service.js'

export async function listItems(
  pagination: PaginationInput,
): Promise<ServiceResult<PaginatedResponse<ItemWithSources>>> {
  const [rows, total] = await Promise.all([findAllItemsWithSources(pagination), countAllItems()])

  return {
    data: buildPaginatedResponse(rows.map((row) => toItemWithSources(row)), pagination, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function getItemById(id: string): Promise<ServiceResult<{ item: ItemWithSources }>> {
  const row = await findItemByIdWithSources(id)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  return {
    data: { item: toItemWithSources(row) },
    httpStatus: HttpStatus.OK,
  }
}

export async function assignCategoriesToItem(
  itemId: string,
  userId: string,
  categoryIds: string[],
): Promise<ServiceResult<{ categories: CategoryPublic[] }>> {
  const item = await findItemById(itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)
  if (item.createdByUserId !== userId) return serviceError(ErrorCode.FORBIDDEN)

  const uniqueIds = Array.from(new Set(categoryIds))
  if (uniqueIds.length > 0) {
    const found = await findCategoriesByIds(uniqueIds)
    if (found.length !== uniqueIds.length) return serviceError(ErrorCode.CATEGORY_NOT_FOUND)
  }

  const assignments = await replaceItemCategories(itemId, uniqueIds)
  return {
    data: { categories: assignments.map((assignment) => toCategoryPublic(assignment.category)) },
    httpStatus: HttpStatus.OK,
  }
}
