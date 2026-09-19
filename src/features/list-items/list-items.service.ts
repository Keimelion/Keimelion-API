import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { findListItemById, updateListItem, deleteListItem } from '../../db/entities/list-items/list-items.repository.js'
import { findListOwner } from '../../db/entities/list-collaborators/list-collaborators.repository.js'
import { findListById } from '../../db/entities/lists/lists.repository.js'
import { toBaseListItemFromRow } from './list-items.mapper.js'
import type { BaseListItem } from '../../shared/types/item.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { UpdateListItemInput } from './endpoints/update-list-item.js'

export async function updateListItemById(
  listItemId: string,
  userId: string,
  input: UpdateListItemInput,
): Promise<ServiceResult<{ listItem: BaseListItem }>> {
  const ownershipResult = await resolveListItemOwnership(listItemId, userId)
  if (ownershipResult.error) return ownershipResult.error

  const updated = await updateListItem(listItemId, pickDefined(input))

  if (!updated) {
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  return { data: { listItem: toBaseListItemFromRow(updated) }, httpStatus: HttpStatus.OK }
}

export async function removeListItem(
  listItemId: string,
  userId: string,
): Promise<ServiceResult<{ message: string }>> {
  const ownershipResult = await resolveListItemOwnership(listItemId, userId)
  if (ownershipResult.error) return ownershipResult.error

  await deleteListItem(listItemId)

  return { data: { message: 'Item removed from list' }, httpStatus: HttpStatus.OK }
}

interface OwnershipCheckResult {
  error: ServiceResult<never> | null
}

async function resolveListItemOwnership(listItemId: string, userId: string): Promise<OwnershipCheckResult> {
  const listItem = await findListItemById(listItemId)

  if (!listItem) {
    return { error: serviceError(ErrorCode.NOT_FOUND) }
  }

  const list = await findListById(listItem.listId)

  if (!list || list.deletedAt) {
    return { error: serviceError(ErrorCode.NOT_FOUND) }
  }

  const owner = await findListOwner(listItem.listId, userId)

  if (!owner) {
    return { error: serviceError(ErrorCode.FORBIDDEN) }
  }

  return { error: null }
}
