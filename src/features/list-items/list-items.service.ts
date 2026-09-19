import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { findListItemById, updateListItem, deleteListItem } from '../../db/entities/list-items/list-items.repository.js'
import { requireListOwnership } from '../lists/list-ownership.js'
import { toBaseListItem } from '../lists/lists.mapper.js'
import type { BaseListItem } from '../../shared/types/item.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { UpdateListItemInput } from './endpoints/update-list-item.js'

export async function updateListItemById(
  listItemId: string,
  userId: string,
  input: UpdateListItemInput,
): Promise<ServiceResult<{ listItem: BaseListItem }>> {
  const listItem = await findListItemById(listItemId)
  if (!listItem) return serviceError(ErrorCode.NOT_FOUND)

  const ownershipError = await requireListOwnership(listItem.listId, userId)
  if (ownershipError) return ownershipError

  const updated = await updateListItem(listItemId, pickDefined(input))
  if (!updated) return serviceError(ErrorCode.INTERNAL_ERROR)

  return { data: { listItem: toBaseListItem(updated) }, httpStatus: HttpStatus.OK }
}

export async function removeListItem(
  listItemId: string,
  userId: string,
): Promise<ServiceResult<{ message: string }>> {
  const listItem = await findListItemById(listItemId)
  if (!listItem) return serviceError(ErrorCode.NOT_FOUND)

  const ownershipError = await requireListOwnership(listItem.listId, userId)
  if (ownershipError) return ownershipError

  await deleteListItem(listItemId)

  return { data: { message: 'Item removed from list' }, httpStatus: HttpStatus.OK }
}
