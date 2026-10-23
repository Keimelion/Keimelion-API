import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { ItemStatuses } from '../../shared/enums/item-status.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { logger } from '../../shared/utils/logger.js'
import {
  deleteListItem,
  findListItemByIdWithImage,
  insertListItem,
  updateListItem,
} from '../../db/entities/list-items/list-items.repository.js'
import { findItemById } from '../../db/entities/items/items.repository.js'
import { deleteImageById } from '../../db/entities/images/images.repository.js'
import { processImage } from '../uploads/image.pipeline.js'
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

  const imageOutcome = await maybeProcessImage(input.imageBuffer, uploadedBy)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)

  const inserted = await insertListItem({
    listId: input.listId,
    itemId: input.itemId,
    quantityDesired: input.quantityDesired ?? DEFAULT_QUANTITY_DESIRED,
    creatorNote: input.creatorNote,
    itemStatus: ItemStatuses.AVAILABLE,
    imageId: imageOutcome.imageId,
  })
  if (!inserted) {
    await rollbackImage(imageOutcome.imageId)
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

  const imageOutcome = await maybeProcessImage(imageBuffer, uploadedBy)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)

  const patch = buildPatchWithImage(fieldPatch, imageOutcome.imageId, clearImage)
  const updated = await updateListItem(listItemId, patch)
  if (!updated) {
    await rollbackImage(imageOutcome.imageId)
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

async function maybeProcessImage(
  buffer: Buffer | null,
  uploadedBy: string,
): Promise<{ imageId: string | null } | { errorCode: ErrorCode }> {
  if (!buffer) return { imageId: null }
  const result = await processImage(buffer, uploadedBy)
  if ('errorCode' in result) return { errorCode: result.errorCode }
  return { imageId: result.image.id }
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

async function rollbackImage(imageId: string | null): Promise<void> {
  if (!imageId) return
  try {
    await deleteImageById(imageId)
  } catch (error: unknown) {
    logger.error({ error, imageId }, 'Failed to rollback image after list_item write failure')
  }
}
