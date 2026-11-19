import type { DbTransaction } from '../../../db/client.js'
import { db } from '../../../db/client.js'
import { buildPaginatedResponse } from '../../../shared/utils/pagination.js'
import { ErrorCode, HttpStatus, ItemContributionActions } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'
import type {
  AdminItemsCreateRequestParsed,
  AdminItemsUpdateRequestParsed,
  PaginatedResponse,
} from '@keimelion/sdk/schemas'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite, buildChanges } from '../../../shared/utils/admin-write.js'
import {
  findItemById,
  findItemByIdForUpdate,
  findItemByIdWithSources,
  insertItem,
  updateItem,
  deleteItem,
  countListItemsReferencing,
} from '../../../db/entities/items/items.repository.js'
import { insertItemSource } from '../../../db/entities/item-sources/item-sources.repository.js'
import { ITEM_SOURCES_ITEM_SHOP_UNIQUE_INDEX } from '../../../db/entities/item-sources/item-sources.schema.js'
import { resolveItemRelations, writeItemRelations } from '../../../shared/db/item-relations.js'
import { recordItemContribution } from '../../../shared/db/item-contributions.js'
import { resolveSourceShops } from '../../../shared/db/source-shops.js'
import { buildSourceUrlFields } from '../../affiliate/affiliate.service.js'
import {
  findAllItemsWithSources,
  findItemByIdWithSourcesAndContributions,
  countItems,
} from './admin-items.repository.js'
import { toItemWithSources } from '../../../shared/types/item.js'
import { toAdminItem, toAdminItemWithContributions } from './admin-items.mapper.js'
import { countReservationsByItemIds } from '../../../db/entities/reservations/reservations.repository.js'
import { AdminAction } from '../admin.enums.js'
import {
  cleanupReplacedImage,
  processOptionalImage,
  runWithImageRollback,
} from '../../uploads/images.service.js'
import type { Item, items } from '../../../db/entities/items/items.schema.js'
import type { ItemRelations } from '../../../shared/db/item-relations.js'
import type { InsertItemSourceInput } from '../../../db/entities/item-sources/item-sources.repository.js'
import type { ItemWithSources } from '../../../shared/types/item.js'
import type { AdminItem, AdminItemWithContributions } from './admin-items.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { ListItemsInput } from './endpoints/list.js'

export interface CreateItemInput extends AdminItemsCreateRequestParsed {
  imageBuffer: Buffer | null
}

export interface UpdateItemInput extends Omit<AdminItemsUpdateRequestParsed, 'clearImage'> {
  imageBuffer: Buffer | null
  clearImage: boolean
}

type CreateSourceInput = AdminItemsCreateRequestParsed['sources'][number]
type SourceWrite = Omit<InsertItemSourceInput, 'itemId' | 'createdByUserId'>
type ItemPatch = Partial<Pick<typeof items.$inferInsert, 'name' | 'description' | 'gtin' | 'imageId'>>

interface ItemUpdateWrite {
  adminId: string
  itemId: string
  patch: ItemPatch
  relations: ItemRelations
}

interface WrittenItemUpdate {
  previous: Item
  updated: Item
}

// The item can be hard-deleted between the pre-check and the transaction: that is a 404, not a write failure.
type ItemUpdateOutcome = { written: WrittenItemUpdate } | { notFound: true }

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

  const sources = await buildSourceWrites(input.sources)

  const imageOutcome = await processOptionalImage(input.imageBuffer, adminId)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)
  const newImageId = imageOutcome.image?.id ?? null

  const outcome = await runWrite(() => runWithImageRollback(newImageId, ADMIN_ITEM_CREATE_CONTEXT, () =>
    db.transaction(async (tx) => {
      const item = await insertItem(
        {
          name: input.name,
          description: input.description,
          gtin: input.gtin,
          imageId: newImageId,
          createdByUserId: null,
        },
        tx,
      )
      if (!item) return undefined

      await insertSources(item.id, sources, tx)
      await writeItemRelations({ itemId: item.id, tagCreatorId: null, relations }, tx)
      return item
    }),
  ), {
    uniqueErrorCodeByConstraint: { [ITEM_SOURCES_ITEM_SHOP_UNIQUE_INDEX]: ErrorCode.DUPLICATE_SHOP_FOR_ITEM },
    foreignKeyErrorCode: ErrorCode.NOT_FOUND,
  })

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
): Promise<ServiceResult<{ item: AdminItemWithContributions }>> {
  const row = await findItemByIdWithSourcesAndContributions(id)
  if (!row) return serviceError(ErrorCode.NOT_FOUND)

  const countByItemId = await countReservationsByItemIds([id])

  return {
    data: { item: toAdminItemWithContributions(row, locale, countByItemId.get(id) ?? 0) },
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
    gtin: input.gtin,
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
  const update: ItemUpdateWrite = { adminId, itemId: id, patch, relations }
  const outcome = await runWrite(() => runWithImageRollback(newImageId, ADMIN_ITEM_UPDATE_CONTEXT, () =>
    db.transaction((tx) => writeItemUpdate(update, tx)),
  ))
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)
  if ('notFound' in outcome.row) return serviceError(ErrorCode.NOT_FOUND)
  const { previous, updated } = outcome.row.written
  await cleanupReplacedImage(previous.imageId, updated.imageId, ADMIN_ITEM_UPDATE_CONTEXT)

  const hydrated = await findItemByIdWithSources(updated.id)
  if (!hydrated) return serviceError(ErrorCode.INTERNAL_ERROR)

  const changes = buildChanges(previous, patch)
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

async function writeItemUpdate(update: ItemUpdateWrite, tx: DbTransaction): Promise<ItemUpdateOutcome> {
  const { adminId, itemId, patch, relations } = update
  // FOR UPDATE upfront: the patch may change gtin (a key column), see ItemLockStrength.
  const previous = await findItemByIdForUpdate(itemId, 'update', tx)
  if (!previous) return { notFound: true }

  const updated = Object.keys(patch).length > 0 ? await updateItem(itemId, patch, tx) : previous
  if (!updated) return { notFound: true }
  await recordItemContribution(
    { itemId, userId: adminId, action: ItemContributionActions.ADMIN_UPDATE, previous, patch },
    tx,
  )
  await writeItemRelations({ itemId, tagCreatorId: null, relations }, tx)
  return { written: { previous, updated } }
}

// Sources without an explicit shopId get the shop matching their URL domain; each URL is normalized with
// the strategy of its shop.
async function buildSourceWrites(sources: CreateSourceInput[]): Promise<SourceWrite[]> {
  const shops = await resolveSourceShops(sources)
  return sources.map((source, index) => {
    const shop = shops[index] ?? null
    return {
      shopId: source.shopId ?? shop?.id ?? null,
      ...buildSourceUrlFields(source.sourceUrl, shop?.slug ?? null),
      price: source.price,
      currency: source.currency,
    }
  })
}

async function insertSources(
  itemId: string,
  sources: SourceWrite[],
  tx: DbTransaction,
): Promise<void> {
  for (const source of sources) {
    const inserted = await insertItemSource({ itemId, ...source, createdByUserId: null }, tx)
    if (!inserted) throw new Error('item_source_insert_failed')
  }
}
