import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { deleteListItem, updateListItem } from '../../db/entities/list-items/list-items.repository.js'
import { toListItemDetail } from '../../shared/types/item.js'
import type { ListItemDetail, ListItemWrite } from '../../shared/types/item.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { PartialWrite } from '../../shared/types/api.js'

export type UpdateListItemInput = PartialWrite<ListItemWrite>

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
