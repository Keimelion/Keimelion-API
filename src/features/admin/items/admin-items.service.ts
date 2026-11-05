import { db } from '../../../db/client.js'
import { buildPaginatedResponse } from '../../../shared/utils/pagination.js'
import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'
import type { PaginatedResponse } from '@keimelion/sdk/schemas'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite, buildChanges } from '../../../shared/utils/admin-write.js'
import {
  findItemById,
  findItemByIdWithSources,
  insertItem,
  updateItem,
  deleteItem,
  countListItemsReferencing,
} from '../../../db/entities/items/items.repository.js'
import { insertItemSource } from '../../../db/entities/item-sources/item-sources.repository.js'
import { resolveItemRelations, writeItemRelations } from '../../../shared/db/item-relations.js'
import { findAllItemsWithSources, countItems } from './admin-items.repository.js'
import { toItemWithSources } from '../../../shared/types/item.js'
import { toAdminItem } from './admin-items.mapper.js'
import { countReservationsByItemIds } from '../../../db/entities/reservations/reservations.repository.js'
import { AdminAction } from '../admin.enums.js'
import {
  cleanupReplacedImage,
  processOptionalImage,
  runWithImageRollback,
} from '../../uploads/images.service.js'
import type { items } from '../../../db/entities/items/items.schema.js'
import type { ItemWithSources } from '../../../shared/types/item.js'
import type { AdminItem } from './admin-items.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { ListItemsInput } from './endpoints/list.js'
import type { CreateItemFields } from './endpoints/create.js'
import type { UpdateItemFields } from './endpoints/update.js'

export interface CreateItemInput extends CreateItemFields {
  imageBuffer: Buffer | null
}

export interface UpdateItemInput extends UpdateItemFields {
  imageBuffer: Buffer | null
  clearImage: boolean
}

type ItemPatch = Partial<Pick<typeof items.$inferInsert, 'name' | 'description' | 'imageId'>>

const ADMIN_ITEM_CREATE_CONTEXT = 'admin.item.create'
const ADMIN_ITEM_UPDATE_CONTEXT = 'admin.item.update'
const ADMIN_ITEM_DELETE_CONTEXT = 'admin.item.delete'

export async function createItem(
  adminId: string,
  input: CreateItemInput,
  locale: Locale,
): Promise<ServiceResult<{ item: ItemWithSources }>> {
  const relations = await resolveItemRelations(input.tags, input.categories)
  if ('errorCode' in relations) return serviceError(relations.errorCode)

  const imageOutcome = await processOptionalImage(input.imageBuffer, adminId)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)
  const newImageId = imageOutcome.image?.id ?? null

  const outcome = await runWrite(() => runWithImageRollback(newImageId, ADMIN_ITEM_CREATE_CONTEXT, () =>
    db.transaction(async (tx) => {
      const item = await insertItem(
        {
          name: input.name,
          description: input.description,
          imageId: newImageId,
          createdByUserId: null,
        },
        tx,
      )
      if (!item) return undefined

      for (const source of input.sources) {
        const inserted = await insertItemSource(
          {
            itemId: item.id,
            shopId: source.shopId,
            sourceUrl: source.sourceUrl,
            price: source.price,
            currency: source.currency,
          },
          tx,
        )
        if (!inserted) throw new Error('item_source_insert_failed')
      }

      await writeItemRelations({ itemId: item.id, tagCreatorId: null, relations }, tx)
      return item
    }),
  ))

  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const hydrated = await findItemByIdWithSources(outcome.row.id)
  if (!hydrated) return serviceError(ErrorCode.INTERNAL_ERROR)

  const item = toItemWithSources(hydrated, locale)
  logger.info({ adminId, action: AdminAction.CREATE_ITEM, itemId: item.id })
  return { data: { item }, httpStatus: HttpStatus.CREATED }
}

export async function listItems(
  input: ListItemsInput,
  locale: Locale,
): Promise<ServiceResult<PaginatedResponse<AdminItem>>> {
  const [rows, total] = await Promise.all([findAllItemsWithSources(input, input), countItems(input)])
  const countByItemId = await countReservationsByItemIds(rows.map((row) => row.id))

  return {
    data: buildPaginatedResponse(
      rows.map((row) => toAdminItem(row, locale, countByItemId.get(row.id) ?? 0)),
      input,
      total,
    ),
    httpStatus: HttpStatus.OK,
  }
}

export async function getItemById(
  id: string,
  locale: Locale,
): Promise<ServiceResult<{ item: AdminItem }>> {
  const row = await findItemByIdWithSources(id)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  const countByItemId = await countReservationsByItemIds([id])

  return {
    data: { item: toAdminItem(row, locale, countByItemId.get(id) ?? 0) },
    httpStatus: HttpStatus.OK,
  }
}

export async function updateItemById(
  adminId: string,
  id: string,
  input: UpdateItemInput,
  locale: Locale,
): Promise<ServiceResult<{ item: ItemWithSources }>> {
  if (input.imageBuffer && input.clearImage) return serviceError(ErrorCode.IMAGE_AND_CLEAR_CONFLICT)

  const existingRow = await findItemById(id)
  if (!existingRow) return serviceError(ErrorCode.NOT_FOUND)

  const fieldPatch: ItemPatch = pickDefined({
    name: input.name,
    description: input.description,
  })

  const { categories, tags } = input
  const hasImageChange = input.imageBuffer !== null || input.clearImage
  if (Object.keys(fieldPatch).length === 0 && categories === undefined && tags === undefined && !hasImageChange) {
    return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  }

  const relations = await resolveItemRelations(tags, categories)
  if ('errorCode' in relations) return serviceError(relations.errorCode)

  const imageOutcome = await processOptionalImage(input.imageBuffer, adminId)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)
  const newImageId = imageOutcome.image?.id ?? null

  const patch: ItemPatch = hasImageChange ? { ...fieldPatch, imageId: newImageId } : fieldPatch
  const outcome = await runWrite(() => runWithImageRollback(newImageId, ADMIN_ITEM_UPDATE_CONTEXT, () =>
    db.transaction(async (tx) => {
      const updated =
        Object.keys(patch).length > 0
          ? await updateItem(id, patch, tx)
          : existingRow
      await writeItemRelations({ itemId: id, tagCreatorId: null, relations }, tx)
      return updated
    }),
  ))
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)
  await cleanupReplacedImage(existingRow.imageId, outcome.row.imageId, ADMIN_ITEM_UPDATE_CONTEXT)

  const hydrated = await findItemByIdWithSources(outcome.row.id)
  if (!hydrated) return serviceError(ErrorCode.INTERNAL_ERROR)

  const changes = buildChanges(existingRow, patch)
  logger.info({ adminId, action: AdminAction.UPDATE_ITEM, itemId: id, changes })
  return { data: { item: toItemWithSources(hydrated, locale) }, httpStatus: HttpStatus.OK }
}

export async function deleteItemById(
  adminId: string,
  id: string,
): Promise<ServiceResult<{ message: string }>> {
  const outcome = await db.transaction(async (tx) => {
    const refCount = await countListItemsReferencing(id, tx)
    if (refCount > 0) {
      return serviceError(ErrorCode.CONFLICT, { message: `Item referenced by ${String(refCount)} list_items` })
    }

    const row = await deleteItem(id, tx)
    if (!row) return serviceError(ErrorCode.NOT_FOUND)

    return row
  })

  if ('httpStatus' in outcome) return outcome
  await cleanupReplacedImage(outcome.imageId, null, ADMIN_ITEM_DELETE_CONTEXT)

  logger.warn({ adminId, action: AdminAction.DELETE_ITEM, itemId: id })
  return { data: { message: 'Item deleted successfully' }, httpStatus: HttpStatus.OK }
}
