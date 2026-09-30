import { db } from '../../../db/client.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite, buildChanges } from '../../../shared/utils/admin-write.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import {
  findItemById,
  findItemByIdWithSources,
  insertItem,
  updateItem,
  deleteItem,
  countListItemsReferencing,
} from '../../../db/entities/items/items.repository.js'
import { insertItemSource } from '../../../db/entities/item-sources/item-sources.repository.js'
import { findAllItemsWithSources, countItems } from './admin-items.repository.js'
import { toItemWithSources } from '../../../shared/types/item.js'
import { AdminAction } from '../admin.enums.js'
import type { items } from '../../../db/entities/items/items.schema.js'
import type { ItemWithSources } from '../../../shared/types/item.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { ListItemsInput } from './endpoints/list.js'
import type { CreateItemInput } from './endpoints/create.js'
import type { UpdateItemInput } from './endpoints/update.js'

const URL_FIELDS = new Set(['imageUrl'])

type ItemUpdateFields = Partial<Pick<typeof items.$inferInsert, 'name' | 'description' | 'imageUrl'>>

export async function createItem(
  adminId: string,
  input: CreateItemInput,
): Promise<ServiceResult<{ item: ItemWithSources }>> {
  const outcome = await runWrite(() =>
    db.transaction(async (tx) => {
      const item = await insertItem(
        {
          name: input.name,
          description: input.description,
          imageUrl: input.imageUrl,
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

      return item
    }),
  )

  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const hydrated = await findItemByIdWithSources(outcome.row.id)
  if (!hydrated) return serviceError(ErrorCode.INTERNAL_ERROR)

  const item = toItemWithSources(hydrated)
  logger.info({ adminId, action: AdminAction.CREATE_ITEM, itemId: item.id })
  return { data: { item }, httpStatus: HttpStatus.CREATED }
}

export async function listItems(
  input: ListItemsInput,
): Promise<ServiceResult<PaginatedResponse<ItemWithSources>>> {
  const [rows, total] = await Promise.all([findAllItemsWithSources(input, input), countItems(input)])

  return {
    data: buildPaginatedResponse(rows.map((row) => toItemWithSources(row)), input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function getItemById(
  id: string,
): Promise<ServiceResult<{ item: ItemWithSources }>> {
  const row = await findItemByIdWithSources(id)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  return {
    data: { item: toItemWithSources(row) },
    httpStatus: HttpStatus.OK,
  }
}

export async function updateItemById(
  adminId: string,
  id: string,
  input: UpdateItemInput,
): Promise<ServiceResult<{ item: ItemWithSources }>> {
  const existingRow = await findItemById(id)
  if (!existingRow) return serviceError(ErrorCode.NOT_FOUND)

  const fieldPatch: ItemUpdateFields = pickDefined({
    name: input.name,
    description: input.description,
    imageUrl: input.imageUrl,
  })

  if (Object.keys(fieldPatch).length === 0) {
    return serviceError(ErrorCode.UNPROCESSABLE_ENTITY, { message: 'At least one field must be provided' })
  }

  const outcome = await runWrite(() => updateItem(id, fieldPatch))
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const hydrated = await findItemByIdWithSources(outcome.row.id)
  if (!hydrated) return serviceError(ErrorCode.INTERNAL_ERROR)

  const changes = buildChanges(existingRow, fieldPatch, { redactFields: URL_FIELDS, redactedValue: '<url>' })
  logger.info({ adminId, action: AdminAction.UPDATE_ITEM, itemId: id, changes })
  return { data: { item: toItemWithSources(hydrated) }, httpStatus: HttpStatus.OK }
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

    return null
  })

  if (outcome !== null) return outcome

  logger.warn({ adminId, action: AdminAction.DELETE_ITEM, itemId: id })
  return { data: { message: 'Item deleted successfully' }, httpStatus: HttpStatus.OK }
}
