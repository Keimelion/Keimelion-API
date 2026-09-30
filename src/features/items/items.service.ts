import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { buildPaginatedResponse } from '../../shared/schemas/pagination.js'
import { findItemById, findAllItems, countAllItems } from '../../db/entities/items/items.repository.js'
import {
  findItemSourcesByItemId,
  findItemSourcesByItemIds,
} from '../../db/entities/item-sources/item-sources.repository.js'
import {
  collectAllSources,
  loadShopsForSources,
  resolveSourcesForItem,
} from '../../db/entities/item-sources/item-sources.hydrate.js'
import { toItemWithSources } from '../../shared/types/item.js'
import type { ItemWithSources } from '../../shared/types/item.js'
import type { PaginationInput } from '../../shared/schemas/pagination.js'
import type { PaginatedResponse } from '../../shared/types/api.js'
import type { ServiceResult } from '../../shared/types/service.js'

export async function listItems(
  pagination: PaginationInput,
): Promise<ServiceResult<PaginatedResponse<ItemWithSources>>> {
  const [rows, total] = await Promise.all([findAllItems(pagination), countAllItems()])
  const sourcesByItemId = await findItemSourcesByItemIds(rows.map((row) => row.id))
  const shopsById = await loadShopsForSources(collectAllSources(sourcesByItemId))

  return {
    data: buildPaginatedResponse(
      rows.map((row) => toItemWithSources(row, resolveSourcesForItem(sourcesByItemId, row.id), shopsById)),
      pagination,
      total,
    ),
    httpStatus: HttpStatus.OK,
  }
}

export async function getItemById(id: string): Promise<ServiceResult<{ item: ItemWithSources }>> {
  const row = await findItemById(id)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  const sources = await findItemSourcesByItemId(id)
  const shopsById = await loadShopsForSources(sources)
  return {
    data: { item: toItemWithSources(row, sources, shopsById) },
    httpStatus: HttpStatus.OK,
  }
}
