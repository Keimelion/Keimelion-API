import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { buildPaginatedResponse } from '../../shared/schemas/pagination.js'
import { normalizeTagSlugs } from '../../shared/utils/slug.js'
import {
  countAllItems,
  findAllItemsWithSources,
  findItemById,
  findItemByIdWithSources,
  insertItem,
  updateItem,
} from '../../db/entities/items/items.repository.js'
import { findCategoriesByIds } from '../../db/entities/categories/categories.repository.js'
import { replaceItemCategories } from '../../db/entities/item-categories/item-categories.repository.js'
import { upsertTagsBySlugs } from '../../db/entities/tags/tags.repository.js'
import { replaceItemTags } from '../../db/entities/item-tags/item-tags.repository.js'
import { toItemWithSources } from '../../shared/types/item.js'
import {
  cleanupReplacedImage,
  processOptionalImage,
  runWithImageRollback,
} from '../uploads/images.service.js'
import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemWithSources } from '../../shared/types/item.js'
import type { PaginationInput } from '../../shared/schemas/pagination.js'
import type { PaginatedResponse } from '../../shared/types/api.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { Locale } from '../../shared/enums/locale.js'
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

interface ItemRelations {
  tagSlugs: string[] | null
  categoryIds: string[] | null
}

interface ItemRelationsWrite {
  itemId: string
  userId: string
  relations: ItemRelations
}

interface ItemUpdateWrite {
  item: Item
  patch: ItemPatch
  userId: string
  relations: ItemRelations
}

const ITEM_CREATE_CONTEXT = 'item.create'
const ITEM_UPDATE_CONTEXT = 'item.update'

export async function listItems(
  pagination: PaginationInput,
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
  const conflict = detectImageSourceConflict(input.imageBuffer, input.imageUrl ?? null, false)
  if (conflict) return serviceError(conflict)

  const relations = await resolveItemRelations(input.tags, input.categories)
  if ('errorCode' in relations) return serviceError(relations.errorCode)

  const imageOutcome = await processOptionalImage(input.imageBuffer, userId)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)
  const newImageId = imageOutcome.image?.id ?? null

  const values = {
    name: input.name,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
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
  const conflict = detectImageSourceConflict(input.imageBuffer, input.imageUrl ?? null, input.clearImage)
  if (conflict) return serviceError(conflict)
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

function detectImageSourceConflict(
  imageBuffer: Buffer | null,
  imageUrl: string | null,
  clearImage: boolean,
): ErrorCode | null {
  if (!imageBuffer) return null
  if (imageUrl !== null) return ErrorCode.ITEM_IMAGE_SOURCE_CONFLICT
  if (clearImage) return ErrorCode.IMAGE_AND_CLEAR_CONFLICT
  return null
}

async function resolveItemRelations(
  tags: string[] | undefined,
  categories: string[] | undefined,
): Promise<ItemRelations | { errorCode: ErrorCode }> {
  const tagSlugs = tags === undefined ? null : normalizeTagSlugs(tags)
  if (tags !== undefined && tagSlugs === null) return { errorCode: ErrorCode.TAG_INVALID_NAME }

  const categoryIds = categories === undefined ? null : Array.from(new Set(categories))
  if (categoryIds !== null && !(await areAllCategoriesFound(categoryIds))) {
    return { errorCode: ErrorCode.CATEGORY_NOT_FOUND }
  }
  return { tagSlugs, categoryIds }
}

async function areAllCategoriesFound(categoryIds: string[]): Promise<boolean> {
  if (categoryIds.length === 0) return true
  const found = await findCategoriesByIds(categoryIds)
  return found.length === categoryIds.length
}

async function insertItemWithRelations(
  values: Parameters<typeof insertItem>[0] & { createdByUserId: string },
  relations: ItemRelations,
  tx: DbTransaction,
): Promise<Item | undefined> {
  const item = await insertItem(values, tx)
  if (!item) return undefined
  await writeItemRelations({ itemId: item.id, userId: values.createdByUserId, relations }, tx)
  return item
}

async function writeItemRelations(write: ItemRelationsWrite, tx: DbTransaction): Promise<void> {
  const { itemId, userId, relations } = write
  if (relations.tagSlugs !== null) {
    const tagIds = await upsertTagsBySlugs(relations.tagSlugs, userId, tx)
    await replaceItemTags(itemId, tagIds, tx)
  }
  if (relations.categoryIds !== null) {
    await replaceItemCategories(itemId, relations.categoryIds, tx)
  }
}

function hasFieldToUpdate(input: UpdateUserItemInput): boolean {
  const { imageBuffer, clearImage, ...fields } = input
  if (imageBuffer !== null || clearImage) return true
  return Object.values(fields).some((value) => value !== undefined)
}

function buildItemPatch(input: UpdateUserItemInput, newImageId: string | null): ItemPatch {
  const patch: ItemPatch = pickDefined({
    name: input.name,
    description: input.description,
    imageUrl: input.imageUrl,
  })
  if (newImageId !== null) return { ...patch, imageId: newImageId, imageUrl: null }
  if (input.clearImage || typeof patch.imageUrl === 'string') return { ...patch, imageId: null }
  return patch
}

async function applyItemUpdate(write: ItemUpdateWrite, tx: DbTransaction): Promise<Item | undefined> {
  const { item, patch, userId, relations } = write
  const updated = Object.keys(patch).length > 0 ? await updateItem(item.id, patch, tx) : item
  if (!updated) return undefined
  await writeItemRelations({ itemId: item.id, userId, relations }, tx)
  return updated
}
