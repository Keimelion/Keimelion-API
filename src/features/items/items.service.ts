import type { DbTransaction } from '../../db/client.js'
import { db } from '../../db/client.js'
import { buildPaginatedResponse } from '../../shared/utils/pagination.js'
import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'
import type {
  ItemsCreateRequestParsed,
  PaginatedResponse,
  PaginationQueryParsed,
} from '@keimelion/sdk/schemas'
import { serviceError } from '../../shared/utils/response.js'
import {
  countAllItems,
  findAllItemsWithSources,
  findItemByIdWithSources,
  insertItem,
} from '../../db/entities/items/items.repository.js'
import { resolveItemRelations, writeItemRelations } from '../../shared/db/item-relations.js'
import { toItemWithSources } from '../../shared/types/item.js'
import { processOptionalImage, runWithImageRollback } from '../uploads/images.service.js'
import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemRelations } from '../../shared/db/item-relations.js'
import type { ItemWithSources } from '../../shared/types/item.js'
import type { ServiceResult } from '../../shared/types/service.js'

export interface CreateUserItemInput extends ItemsCreateRequestParsed {
  imageBuffer: Buffer | null
}

const ITEM_CREATE_CONTEXT = 'item.create'

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
