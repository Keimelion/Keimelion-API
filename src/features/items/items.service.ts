import { db } from '../../db/client.js'
import { buildPaginatedResponse } from '../../shared/utils/pagination.js'
import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'
import type { PaginatedResponse, PaginationQueryParsed } from '@keimelion/sdk/schemas'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import {
  countAllItems,
  findAllItemsWithSources,
  findItemById,
  findItemByIdWithSources,
  insertItem,
  updateItem,
} from '../../db/entities/items/items.repository.js'
import { resolveItemRelations, writeItemRelations } from '../../shared/db/item-relations.js'
import { toItemWithSources } from '../../shared/types/item.js'
import {
  cleanupReplacedImage,
  processOptionalImage,
  runWithImageRollback,
} from '../uploads/images.service.js'
import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemRelations } from '../../shared/db/item-relations.js'
import type { ItemWithSources } from '../../shared/types/item.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { CreateItemFields } from './endpoints/create.js'
import type { UpdateItemFields } from './endpoints/update.js'

export interface CreateUserItemInput extends CreateItemFields {
  imageBuffer: Buffer | null
}

export interface UpdateUserItemInput extends UpdateItemFields {
  imageBuffer: Buffer | null
  clearImage: boolean
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type ItemPatch = Parameters<typeof updateItem>[1]

interface ItemUpdateWrite {
  item: Item
  patch: ItemPatch
  userId: string
  relations: ItemRelations
}

const ITEM_CREATE_CONTEXT = 'item.create'
const ITEM_UPDATE_CONTEXT = 'item.update'

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

export async function createUserItem(
  userId: string,
  input: CreateUserItemInput,
  locale: Locale,
): Promise<ServiceResult<{ item: ItemWithSources }>> {
  const relations = await resolveItemRelations(input.tags, input.categories)
  if ('errorCode' in relations) return serviceError(relations.errorCode)

  const imageOutcome = await processOptionalImage(input.imageBuffer, userId)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)
  const newImageId = imageOutcome.image?.id ?? null

  const values = {
    name: input.name,
    description: input.description ?? null,
    imageId: newImageId,
    createdByUserId: userId,
  }
  const inserted = await runWithImageRollback(newImageId, ITEM_CREATE_CONTEXT, () =>
    db.transaction((tx) => insertItemWithRelations(values, relations, tx)),
  )
  if (!inserted) return serviceError(ErrorCode.INTERNAL_ERROR)

  const row = await findItemByIdWithSources(inserted.id)
  if (!row) return serviceError(ErrorCode.INTERNAL_ERROR)
  return { data: { item: toItemWithSources(row, locale) }, httpStatus: HttpStatus.CREATED }
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

export async function updateUserItem(
  itemId: string,
  userId: string,
  input: UpdateUserItemInput,
  locale: Locale,
): Promise<ServiceResult<{ item: ItemWithSources }>> {
  if (input.imageBuffer && input.clearImage) return serviceError(ErrorCode.IMAGE_AND_CLEAR_CONFLICT)
  if (!hasFieldToUpdate(input)) return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)

  const item = await findItemById(itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)
  if (item.createdByUserId !== userId) return serviceError(ErrorCode.FORBIDDEN)

  const relations = await resolveItemRelations(input.tags, input.categories)
  if ('errorCode' in relations) return serviceError(relations.errorCode)

  const imageOutcome = await processOptionalImage(input.imageBuffer, userId)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)
  const newImageId = imageOutcome.image?.id ?? null

  const write: ItemUpdateWrite = { item, patch: buildItemPatch(input, newImageId), userId, relations }
  const updated = await runWithImageRollback(newImageId, ITEM_UPDATE_CONTEXT, () =>
    db.transaction((tx) => applyItemUpdate(write, tx)),
  )
  if (!updated) return serviceError(ErrorCode.NOT_FOUND)
  await cleanupReplacedImage(item.imageId, updated.imageId, ITEM_UPDATE_CONTEXT)

  const refreshed = await findItemByIdWithSources(itemId)
  if (!refreshed) return serviceError(ErrorCode.NOT_FOUND)
  return { data: { item: toItemWithSources(refreshed, locale) }, httpStatus: HttpStatus.OK }
}

async function insertItemWithRelations(
  values: Parameters<typeof insertItem>[0] & { createdByUserId: string },
  relations: ItemRelations,
  tx: DbTransaction,
): Promise<Item | undefined> {
  const item = await insertItem(values, tx)
  if (!item) return undefined
  await writeItemRelations({ itemId: item.id, tagCreatorId: values.createdByUserId, relations }, tx)
  return item
}

function hasFieldToUpdate(input: UpdateUserItemInput): boolean {
  const { imageBuffer, clearImage, ...fields } = input
  if (imageBuffer !== null || clearImage) return true
  return Object.values(fields).some((value) => value !== undefined)
}

function buildItemPatch(input: UpdateUserItemInput, newImageId: string | null): ItemPatch {
  const patch: ItemPatch = pickDefined({ name: input.name, description: input.description })
  if (newImageId !== null) return { ...patch, imageId: newImageId }
  if (input.clearImage) return { ...patch, imageId: null }
  return patch
}

async function applyItemUpdate(write: ItemUpdateWrite, tx: DbTransaction): Promise<Item | undefined> {
  const { item, patch, userId, relations } = write
  const updated = Object.keys(patch).length > 0 ? await updateItem(item.id, patch, tx) : item
  if (!updated) return undefined
  await writeItemRelations({ itemId: item.id, tagCreatorId: userId, relations }, tx)
  return updated
}
