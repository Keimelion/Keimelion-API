import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
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
import type { ItemWithSources } from '../../shared/types/item.js'
import type { PaginationInput } from '../../shared/schemas/pagination.js'
import type { PaginatedResponse } from '../../shared/types/api.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { Locale } from '../../shared/enums/locale.js'
import type { CreateItemInput } from './endpoints/create.js'
import type { UpdateItemInput } from './endpoints/update.js'

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
  input: CreateItemInput,
  locale: Locale,
): Promise<ServiceResult<{ item: ItemWithSources }>> {
  const { tags, categories } = input

  let tagSlugs: string[] | null = null
  if (tags !== undefined) {
    tagSlugs = normalizeTagSlugs(tags)
    if (tagSlugs === null) return serviceError(ErrorCode.TAG_INVALID_NAME)
  }

  let uniqueCategoryIds: string[] | null = null
  if (categories !== undefined) {
    uniqueCategoryIds = Array.from(new Set(categories))
    if (uniqueCategoryIds.length > 0) {
      const found = await findCategoriesByIds(uniqueCategoryIds)
      if (found.length !== uniqueCategoryIds.length) {
        return serviceError(ErrorCode.CATEGORY_NOT_FOUND)
      }
    }
  }

  const inserted = await db.transaction(async (tx) => {
    const item = await insertItem(
      {
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        createdByUserId: userId,
      },
      tx,
    )
    if (!item) return undefined

    if (tagSlugs !== null) {
      const tagIds = await upsertTagsBySlugs(tagSlugs, userId, tx)
      await replaceItemTags(item.id, tagIds, tx)
    }
    if (uniqueCategoryIds !== null) {
      await replaceItemCategories(item.id, uniqueCategoryIds, tx)
    }

    return item
  })
  if (!inserted) return serviceError(ErrorCode.INTERNAL_ERROR)

  const row = await findItemByIdWithSources(inserted.id)
  if (!row) return serviceError(ErrorCode.INTERNAL_ERROR)
  return {
    data: { item: toItemWithSources(row, locale) },
    httpStatus: HttpStatus.CREATED,
  }
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
  input: UpdateItemInput,
  locale: Locale,
): Promise<ServiceResult<{ item: ItemWithSources }>> {
  const { name, description, imageUrl, tags, categories } = input
  if (
    name === undefined &&
    description === undefined &&
    imageUrl === undefined &&
    tags === undefined &&
    categories === undefined
  ) {
    return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  }

  const item = await findItemById(itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)
  if (item.createdByUserId !== userId) return serviceError(ErrorCode.FORBIDDEN)

  let tagSlugs: string[] | null = null
  if (tags !== undefined) {
    tagSlugs = normalizeTagSlugs(tags)
    if (tagSlugs === null) return serviceError(ErrorCode.TAG_INVALID_NAME)
  }

  let uniqueCategoryIds: string[] | null = null
  if (categories !== undefined) {
    uniqueCategoryIds = Array.from(new Set(categories))
    if (uniqueCategoryIds.length > 0) {
      const found = await findCategoriesByIds(uniqueCategoryIds)
      if (found.length !== uniqueCategoryIds.length) {
        return serviceError(ErrorCode.CATEGORY_NOT_FOUND)
      }
    }
  }

  const scalarFields: Parameters<typeof updateItem>[1] = {}
  if (name !== undefined) scalarFields.name = name
  if (description !== undefined) scalarFields.description = description
  if (imageUrl !== undefined) scalarFields.imageUrl = imageUrl

  await db.transaction(async (tx) => {
    if (Object.keys(scalarFields).length > 0) {
      await updateItem(itemId, scalarFields, tx)
    }
    if (tagSlugs !== null) {
      const tagIds = await upsertTagsBySlugs(tagSlugs, userId, tx)
      await replaceItemTags(itemId, tagIds, tx)
    }
    if (uniqueCategoryIds !== null) {
      await replaceItemCategories(itemId, uniqueCategoryIds, tx)
    }
  })

  const refreshed = await findItemByIdWithSources(itemId)
  if (!refreshed) return serviceError(ErrorCode.NOT_FOUND)
  return {
    data: { item: toItemWithSources(refreshed, locale) },
    httpStatus: HttpStatus.OK,
  }
}
