import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { ItemStatuses } from '../../shared/enums/item-status.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import {
  deleteListItem,
  findListItemByIdWithImage,
  insertListItem,
  updateListItem,
} from '../../db/entities/list-items/list-items.repository.js'
import { findItemById } from '../../db/entities/items/items.repository.js'
import { processOptionalImage, rollbackImage } from '../uploads/images.service.js'
import { toListItemDetail } from '../../shared/types/item.js'
import type { ListItemDetail, ListItemRowWithImage, ListItemWrite } from '../../shared/types/item.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { PartialWrite } from '../../shared/types/api.js'

const DEFAULT_QUANTITY_DESIRED = 1

export interface CreateListItemInput {
  listId: string
  itemId: string
  quantityDesired: number | null
  creatorNote: string | null
  imageBuffer: Buffer | null
}

export interface UpdateListItemInput extends PartialWrite<ListItemWrite> {
  imageBuffer: Buffer | null
  clearImage: boolean
}

export async function createListItem(
  input: CreateListItemInput,
  uploadedBy: string,
): Promise<ServiceResult<{ listItem: ListItemDetail }>> {
  const item = await findItemById(input.itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)

  const imageOutcome = await processOptionalImage(input.imageBuffer, uploadedBy)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)
  const newImageId = imageOutcome.image?.id ?? null

  const inserted = await insertListItem({
    listId: input.listId,
    itemId: input.itemId,
    quantityDesired: input.quantityDesired ?? DEFAULT_QUANTITY_DESIRED,
    creatorNote: input.creatorNote,
    itemStatus: ItemStatuses.AVAILABLE,
    imageId: newImageId,
  })
  if (!inserted) {
    await rollbackImage(newImageId, 'list_item.create')
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  const row = await hydrateImage(inserted)
  return { data: { listItem: toListItemDetail(row) }, httpStatus: HttpStatus.CREATED }
}

export async function updateListItemById(
  listItemId: string,
  input: UpdateListItemInput,
  uploadedBy: string,
): Promise<ServiceResult<{ listItem: ListItemDetail }>> {
  const { imageBuffer, clearImage, ...fields } = input
  const fieldPatch = pickDefined(fields)
  const hasFieldPatch = Object.keys(fieldPatch).length > 0
  if (!hasFieldPatch && !imageBuffer && !clearImage) {
    return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  }

  const imageOutcome = await processOptionalImage(imageBuffer, uploadedBy)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)
  const newImageId = imageOutcome.image?.id ?? null

  const patch = buildPatchWithImage(fieldPatch, newImageId, clearImage)
  const updated = await updateListItem(listItemId, patch)
  if (!updated) {
    await rollbackImage(newImageId, 'list_item.update')
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  const row = await hydrateImage(updated)
  return { data: { listItem: toListItemDetail(row) }, httpStatus: HttpStatus.OK }
}

async function hydrateImage(listItem: ListItem): Promise<ListItemRowWithImage> {
  if (!listItem.imageId) return { ...listItem, image: null }
  const hydrated = await findListItemByIdWithImage(listItem.id)
  return hydrated ?? { ...listItem, image: null }
}

export async function removeListItem(
  listItemId: string,
): Promise<ServiceResult<{ message: string }>> {
  await deleteListItem(listItemId)
  return { data: { message: 'Item removed from list' }, httpStatus: HttpStatus.OK }
}

function buildPatchWithImage(
  fieldPatch: Partial<Pick<ListItemWrite, 'quantityDesired' | 'creatorNote' | 'sortOrder'>>,
  newImageId: string | null,
  clearImage: boolean,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { ...fieldPatch }
  if (newImageId !== null) {
    patch.imageId = newImageId
  } else if (clearImage) {
    patch.imageId = null
  }
  return patch
}
