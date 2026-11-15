import { buildPaginatedResponse } from '../../shared/utils/pagination.js'
import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'
import type { PaginatedResponse, PaginationQueryParsed } from '@keimelion/sdk/schemas'
import { serviceError } from '../../shared/utils/response.js'
import {
  countAllItems,
  findAllItemsWithSources,
  findItemByIdWithSources,
} from '../../db/entities/items/items.repository.js'
import { toItemWithSources } from '../../shared/types/item.js'
import type { ItemWithSources } from '../../shared/types/item.js'
import type { ServiceResult } from '../../shared/types/service.js'

export async function listItems(
  pagination: PaginationQueryParsed,
  locale: Locale,
): Promise<ServiceResult<PaginatedResponse<ItemWithSources>>> {
  const [rows, total] = await Promise.all([findAllItemsWithSources(pagination), countAllItems()])

  return {
    data: buildPaginatedResponse(
      rows.map((row) => toItemWithSources(row, locale)),
      pagination,
      total,
    ),
    httpStatus: HttpStatus.OK,
  }
}

export async function getItemById(
  id: string,
  locale: Locale,
): Promise<ServiceResult<{ item: ItemWithSources }>> {
  const row = await findItemByIdWithSources(id)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  return {
    data: { item: toItemWithSources(row, locale) },
    httpStatus: HttpStatus.OK,
  }
}
