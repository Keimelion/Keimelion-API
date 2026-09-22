import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { updateListItem, deleteListItem } from '../../db/entities/list-items/list-items.repository.js'
import { toListItemDetail } from '../lists/lists.mapper.js'
import type { ListItemDetail, ListItemWrite } from '../../shared/types/item.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { PartialWrite } from '../../shared/types/api.js'

export async function updateListItemById(
  listItemId: string,
  input: PartialWrite<ListItemWrite>,
): Promise<ServiceResult<{ listItem: ListItemDetail }>> {
  const updated = await updateListItem(listItemId, pickDefined(input))
  if (!updated) return serviceError(ErrorCode.INTERNAL_ERROR)

  return { data: { listItem: toListItemDetail(updated) }, httpStatus: HttpStatus.OK }
}

export async function removeListItem(
  listItemId: string,
): Promise<ServiceResult<{ message: string }>> {
  await deleteListItem(listItemId)
  return { data: { message: 'Item removed from list' }, httpStatus: HttpStatus.OK }
}
