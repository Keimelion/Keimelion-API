import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { buildPaginatedResponse } from '../../shared/schemas/pagination.js'
import { findItemById, findLiveItems, countLiveItems } from '../../db/entities/items/items.repository.js'
import {
  findItemSourcesByItemId,
  findItemSourcesByItemIds,
} from '../../db/entities/item-sources/item-sources.repository.js'
import { toItemWithSources } from './items.mapper.js'
import type { ItemWithSources } from './items.mapper.js'
import type { ItemSource } from '../../db/entities/item-sources/item-sources.schema.js'
import type { PaginationInput } from '../../shared/schemas/pagination.js'
import type { PaginatedResponse } from '../../shared/types/api.js'
import type { ServiceResult } from '../../shared/types/service.js'

export async function listItems(
  pagination: PaginationInput,
): Promise<ServiceResult<PaginatedResponse<ItemWithSources>>> {
  const [rows, total] = await Promise.all([findLiveItems(pagination), countLiveItems()])
  const sourcesByItemId = await findItemSourcesByItemIds(rows.map((row) => row.id))

  return {
    data: buildPaginatedResponse(
      rows.map((row) => toItemWithSources(row, resolveSources(sourcesByItemId, row.id))),
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
  return {
    data: { item: toItemWithSources(row, sources) },
    httpStatus: HttpStatus.OK,
  }
}

function resolveSources(map: Map<string, ItemSource[]>, itemId: string): ItemSource[] {
  return map.get(itemId) ?? []
}
