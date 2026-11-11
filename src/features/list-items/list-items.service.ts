import { ErrorCode, HttpStatus, ItemStatuses } from '@keimelion/sdk/enums'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import {
  deleteListItem,
  insertListItem,
  updateListItem,
} from '../../db/entities/list-items/list-items.repository.js'
import { findItemById } from '../../db/entities/items/items.repository.js'
import { toListItemDetail } from '../../shared/types/item.js'
import type { ListItemDetail, ListItemWrite } from '../../shared/types/item.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { PartialWrite } from '../../shared/types/api.js'

const DEFAULT_QUANTITY_DESIRED = 1

export interface CreateListItemInput {
  listId: string
  itemId: string
  quantityDesired: number | null
  creatorNote: string | null
}

export type UpdateListItemInput = PartialWrite<ListItemWrite>

export async function createListItem(
  input: CreateListItemInput,
): Promise<ServiceResult<{ listItem: ListItemDetail }>> {
  const item = await findItemById(input.itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)

  const inserted = await insertListItem({
    listId: input.listId,
    itemId: input.itemId,
    quantityDesired: input.quantityDesired ?? DEFAULT_QUANTITY_DESIRED,
    creatorNote: input.creatorNote,
    itemStatus: ItemStatuses.AVAILABLE,
  })
  if (!inserted) return serviceError(ErrorCode.INTERNAL_ERROR)

  return { data: { listItem: toListItemDetail(inserted) }, httpStatus: HttpStatus.CREATED }
}

export async function updateListItemById(
  listItemId: string,
  input: UpdateListItemInput,
): Promise<ServiceResult<{ listItem: ListItemDetail }>> {
  const patch = pickDefined(input)
  if (Object.keys(patch).length === 0) {
    return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  }

  const updated = await updateListItem(listItemId, patch)
  if (!updated) return serviceError(ErrorCode.INTERNAL_ERROR)

  return { data: { listItem: toListItemDetail(updated) }, httpStatus: HttpStatus.OK }
}

export async function removeListItem(
  listItemId: string,
): Promise<ServiceResult<{ message: string }>> {
  await deleteListItem(listItemId)
  return { data: { message: 'Item removed from list' }, httpStatus: HttpStatus.OK }
}
