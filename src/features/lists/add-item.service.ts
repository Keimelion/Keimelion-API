import type { DbTransaction } from '../../db/client.js'
import { db } from '../../db/client.js'
import { ErrorCode, HttpStatus, ItemStatuses } from '@keimelion/sdk/enums'
import { DEFAULT_SOURCE_CURRENCY } from '@keimelion/sdk/schemas'
import type {
  ListItemAlreadyExistsMetadataParsed,
  ListsAddItemByIdRequestParsed,
  ListsAddItemRequestParsed,
  ListsAddProductRequestParsed,
} from '@keimelion/sdk/schemas'
import { serviceError } from '../../shared/utils/response.js'
import { findPgConstraintName, isPgUniqueViolation } from '../../shared/db/pg-errors.js'
import { resolveItemRelations, writeItemRelations } from '../../shared/db/item-relations.js'
import { resolveSourceShop } from '../../shared/db/source-shops.js'
import {
  fillMissingItemFields,
  findItemByGtinWithImage,
  findItemByIdWithImage,
  insertItem,
} from '../../db/entities/items/items.repository.js'
import { ITEMS_GTIN_UNIQUE_INDEX } from '../../db/entities/items/items.schema.js'
import { ITEM_SOURCES_SOURCE_URL_UNIQUE_INDEX } from '../../db/entities/item-sources/item-sources.schema.js'
import {
  findItemSourceByItemAndShop,
  findItemSourceBySourceUrl,
  insertItemSource,
  insertItemSourceIfAbsent,
  updateItemSource,
} from '../../db/entities/item-sources/item-sources.repository.js'
import {
  findListItemByListAndItem,
  insertListItemIfAbsent,
} from '../../db/entities/list-items/list-items.repository.js'
import { toItemDetail, toItemSourceDetail, toListItemDetail } from '../../shared/types/item.js'
import { buildSourceUrlFields } from '../affiliate/affiliate.service.js'
import { processOptionalImage, rollbackImage, runWithImageRollback } from '../uploads/images.service.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { Shop } from '../../db/entities/shops/shops.schema.js'
import type { MissingItemFields } from '../../db/entities/items/items.repository.js'
import type { ItemRelations } from '../../shared/db/item-relations.js'
import type { ItemRowWithImage, ItemSourceWithShop, ItemSourceWithShopAndItem } from '../../shared/types/item.js'
import type { SubmittedSourceUrlFields } from '../affiliate/affiliate.service.js'
import type { ListItemResponse } from './lists.types.js'
import type { ServiceResult } from '../../shared/types/service.js'

export interface AddItemToListInput {
  listId: string
  userId: string
  request: ListsAddItemRequestParsed
  imageBuffer: Buffer | null
}

type AddItemResult = ServiceResult<{ listItem: ListItemResponse }>

interface ResolvedSourceUrl {
  shop: Shop | null
  urlFields: SubmittedSourceUrlFields
}

interface SourceOffer {
  url: ResolvedSourceUrl | null
  price: string | null
  currency: string
}

interface ItemCompletion {
  description: string | null
  gtin: string | null
}

interface KnownItemLink {
  item: ItemRowWithImage
  customName: string | null
  offer: SourceOffer
  urlHolder: ItemSourceWithShop | null
  completion: ItemCompletion
}

interface ProductLookup {
  item: ItemRowWithImage
  urlHolder: ItemSourceWithShop | null
}

interface WrittenListItem {
  listItem: ListItem
  source: ItemSourceWithShop | null
}

type KnownItemOutcome = { duplicate: ListItem | undefined } | { written: WrittenListItem; item: ItemRowWithImage }

const DEFAULT_QUANTITY_DESIRED = 1
const ADD_PRODUCT_CONTEXT = 'list.add-product'
const COMPLETE_ITEM_CONTEXT = 'list.complete-item'
const CONCURRENT_PRODUCT_CONSTRAINTS = new Set([ITEMS_GTIN_UNIQUE_INDEX, ITEM_SOURCES_SOURCE_URL_UNIQUE_INDEX])

export function addItemToList(input: AddItemToListInput): Promise<AddItemResult> {
  if ('itemId' in input.request) return addItemById(input, input.request)
  return addProduct(input, input.request)
}

async function resolveSourceUrl(submittedUrl: string | undefined): Promise<ResolvedSourceUrl | null> {
  if (submittedUrl === undefined) return null
  const shop = await resolveSourceShop({ shopId: null, sourceUrl: submittedUrl })
  return { shop, urlFields: buildSourceUrlFields(submittedUrl, shop?.slug ?? null) }
}

async function findUrlHolder(sourceUrl: ResolvedSourceUrl | null): Promise<ItemSourceWithShopAndItem | null> {
  if (sourceUrl === null) return null
  return (await findItemSourceBySourceUrl(sourceUrl.urlFields.sourceUrl)) ?? null
}

async function addItemById(input: AddItemToListInput, request: ListsAddItemByIdRequestParsed): Promise<AddItemResult> {
  const item = await findItemByIdWithImage(request.itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)

  const sourceUrl = await resolveSourceUrl(request.sourceUrl)
  return linkKnownItem(input, {
    item,
    customName: request.customName ?? null,
    offer: { url: sourceUrl, price: null, currency: DEFAULT_SOURCE_CURRENCY },
    urlHolder: await findUrlHolder(sourceUrl),
    completion: { description: null, gtin: null },
  })
}

async function addProduct(input: AddItemToListInput, product: ListsAddProductRequestParsed): Promise<AddItemResult> {
  const sourceUrl = await resolveSourceUrl(product.sourceUrl)
  const known = await findKnownProduct(product, sourceUrl)
  if (known) return linkKnownProduct(input, { product, sourceUrl, known })

  const created = await createProduct(input, product, sourceUrl)
  if (created !== null) return created

  const concurrentlyCreated = await findKnownProduct(product, sourceUrl)
  if (!concurrentlyCreated) return serviceError(ErrorCode.INTERNAL_ERROR)
  return linkKnownProduct(input, { product, sourceUrl, known: concurrentlyCreated })
}

async function findKnownProduct(
  product: ListsAddProductRequestParsed,
  sourceUrl: ResolvedSourceUrl | null,
): Promise<ProductLookup | null> {
  const urlHolder = await findUrlHolder(sourceUrl)
  if (urlHolder) return { item: urlHolder.item, urlHolder }
  if (product.gtin === undefined) return null

  const item = await findItemByGtinWithImage(product.gtin)
  return item ? { item, urlHolder: null } : null
}

interface KnownProductLink {
  product: ListsAddProductRequestParsed
  sourceUrl: ResolvedSourceUrl | null
  known: ProductLookup
}

function linkKnownProduct(input: AddItemToListInput, link: KnownProductLink): Promise<AddItemResult> {
  const { product, sourceUrl, known } = link
  return linkKnownItem(input, {
    item: known.item,
    customName: resolveKnownProductCustomName(product, known.item),
    offer: { url: sourceUrl, price: product.price ?? null, currency: product.currency },
    urlHolder: known.urlHolder,
    completion: { description: product.description ?? null, gtin: product.gtin ?? null },
  })
}

function resolveKnownProductCustomName(product: ListsAddProductRequestParsed, item: ItemRowWithImage): string | null {
  if (product.customName !== undefined) return product.customName
  return product.name === item.name ? null : product.name
}

async function linkKnownItem(input: AddItemToListInput, link: KnownItemLink): Promise<AddItemResult> {
  const imageOutcome = await processOptionalImage(link.item.imageId === null ? input.imageBuffer : null, input.userId)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)

  const { image } = imageOutcome
  const outcome = await runWithImageRollback(image?.id ?? null, COMPLETE_ITEM_CONTEXT, () =>
    db.transaction((tx) => writeKnownItemLink(input, link, image, tx)),
  )
  if (!outcome) return serviceError(ErrorCode.INTERNAL_ERROR)
  await discardUnusedImage(image, outcome)

  if ('duplicate' in outcome) return listItemAlreadyExists(outcome.duplicate)
  return buildCreatedResult(outcome.written, outcome.item)
}

async function writeKnownItemLink(
  input: AddItemToListInput,
  link: KnownItemLink,
  image: Image | null,
  tx: DbTransaction,
): Promise<KnownItemOutcome> {
  const listItem = await insertListItemIfAbsent(buildListItemValues(input, link.item.id, link.customName), tx)
  if (!listItem) return { duplicate: await findListItemByListAndItem(input.listId, link.item.id, tx) }

  const item = await completeItem(link.item, { ...link.completion, imageId: image?.id ?? null }, tx)
  const source = await writeSourceOffer(input.userId, item.id, link, tx)
  return { written: { listItem, source }, item }
}

async function discardUnusedImage(image: Image | null, outcome: KnownItemOutcome): Promise<void> {
  if (image === null) return
  if ('written' in outcome && outcome.item.imageId === image.id) return
  await rollbackImage(image.id, COMPLETE_ITEM_CONTEXT)
}

async function completeItem(
  item: ItemRowWithImage,
  completion: ItemCompletion & { imageId: string | null },
  tx: DbTransaction,
): Promise<ItemRowWithImage> {
  const missing = pickMissingFields(item, completion)
  const { gtin, ...withoutGtin } = missing
  if (Object.keys(missing).length === 0) return item

  if (Object.keys(withoutGtin).length > 0) await fillMissingItemFields(item.id, withoutGtin, tx)
  if (gtin !== undefined) await fillMissingGtin(item.id, gtin, tx)
  return (await findItemByIdWithImage(item.id, tx)) ?? item
}

function pickMissingFields(
  item: ItemRowWithImage,
  completion: ItemCompletion & { imageId: string | null },
): MissingItemFields {
  return {
    ...(item.description === null && completion.description !== null ? { description: completion.description } : {}),
    ...(item.gtin === null && completion.gtin !== null ? { gtin: completion.gtin } : {}),
    ...(item.imageId === null && completion.imageId !== null ? { imageId: completion.imageId } : {}),
  }
}

async function fillMissingGtin(itemId: string, gtin: string, tx: DbTransaction): Promise<void> {
  try {
    await tx.transaction((savepoint) => fillMissingItemFields(itemId, { gtin }, savepoint))
  } catch (error) {
    if (isPgUniqueViolation(error) && findPgConstraintName(error) === ITEMS_GTIN_UNIQUE_INDEX) return
    throw error
  }
}

async function writeSourceOffer(
  userId: string,
  itemId: string,
  link: KnownItemLink,
  tx: DbTransaction,
): Promise<ItemSourceWithShop | null> {
  const { offer, urlHolder } = link
  if (urlHolder !== null) return urlHolder.itemId === itemId ? updateSourcePrice(urlHolder, offer, tx) : null

  const shop = offer.url?.shop
  if (!offer.url || !shop) return null

  const existing = await findItemSourceByItemAndShop(itemId, shop.id, tx)
  if (existing) return updateSourcePrice(existing, offer, tx)

  const inserted = await insertItemSourceIfAbsent(
    {
      itemId,
      shopId: shop.id,
      ...offer.url.urlFields,
      price: offer.price,
      currency: offer.currency,
      createdByUserId: userId,
    },
    tx,
  )
  if (inserted) return { ...inserted, shop }
  return (await findItemSourceByItemAndShop(itemId, shop.id, tx)) ?? null
}

async function updateSourcePrice(
  source: ItemSourceWithShop,
  offer: SourceOffer,
  tx: DbTransaction,
): Promise<ItemSourceWithShop> {
  if (offer.price === null || offer.price === source.price || offer.currency !== source.currency) return source
  const updated = await updateItemSource(source.id, { price: offer.price }, tx)
  return updated ? { ...updated, shop: source.shop } : source
}

function listItemAlreadyExists(existing: ListItem | undefined): AddItemResult {
  if (!existing) return serviceError(ErrorCode.CONFLICT)
  const metadata: ListItemAlreadyExistsMetadataParsed = {
    listItemId: existing.id,
    quantityDesired: existing.quantityDesired,
  }
  return serviceError(ErrorCode.LIST_ITEM_ALREADY_EXISTS, metadata)
}

async function createProduct(
  input: AddItemToListInput,
  product: ListsAddProductRequestParsed,
  sourceUrl: ResolvedSourceUrl | null,
): Promise<AddItemResult | null> {
  const relations = await resolveItemRelations(product.tags, product.categories)
  if ('errorCode' in relations) return serviceError(relations.errorCode)

  const imageOutcome = await processOptionalImage(input.imageBuffer, input.userId)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)

  const newProduct = { input, product, sourceUrl, relations, image: imageOutcome.image }
  try {
    const written = await runWithImageRollback(newProduct.image?.id ?? null, ADD_PRODUCT_CONTEXT, () =>
      db.transaction((tx) => insertProduct(newProduct, tx)),
    )
    if (!written) return serviceError(ErrorCode.INTERNAL_ERROR)
    return buildCreatedResult(written, written.item)
  } catch (error) {
    if (isConcurrentProductConflict(error)) return null
    throw error
  }
}

function isConcurrentProductConflict(error: unknown): boolean {
  if (!isPgUniqueViolation(error)) return false
  const constraint = findPgConstraintName(error)
  return constraint !== null && CONCURRENT_PRODUCT_CONSTRAINTS.has(constraint)
}

interface NewProduct {
  input: AddItemToListInput
  product: ListsAddProductRequestParsed
  sourceUrl: ResolvedSourceUrl | null
  relations: ItemRelations
  image: Image | null
}

async function insertProduct(
  newProduct: NewProduct,
  tx: DbTransaction,
): Promise<WrittenListItem & { item: ItemRowWithImage }> {
  const { input, product, relations, image } = newProduct
  const item = await insertItem(
    {
      name: product.name,
      description: product.description ?? null,
      gtin: product.gtin ?? null,
      imageId: image?.id ?? null,
      createdByUserId: input.userId,
    },
    tx,
  )
  if (!item) throw new Error('item_insert_failed')

  const source = await insertProductSource(item.id, newProduct, tx)
  await writeItemRelations({ itemId: item.id, tagCreatorId: input.userId, relations }, tx)
  const listItem = await insertListItemIfAbsent(buildListItemValues(input, item.id, product.customName ?? null), tx)
  if (!listItem) throw new Error('list_item_insert_failed')
  return { item: { ...item, image }, listItem, source }
}

async function insertProductSource(
  itemId: string,
  newProduct: NewProduct,
  tx: DbTransaction,
): Promise<ItemSourceWithShop | null> {
  const { input, product, sourceUrl } = newProduct
  if (sourceUrl === null) return null

  const source = await insertItemSource(
    {
      itemId,
      shopId: sourceUrl.shop?.id ?? null,
      ...sourceUrl.urlFields,
      price: product.price ?? null,
      currency: product.currency,
      createdByUserId: input.userId,
    },
    tx,
  )
  if (!source) throw new Error('item_source_insert_failed')
  return { ...source, shop: sourceUrl.shop }
}

function buildListItemValues(
  input: AddItemToListInput,
  itemId: string,
  customName: string | null,
): Parameters<typeof insertListItemIfAbsent>[0] {
  return {
    listId: input.listId,
    itemId,
    quantityDesired: input.request.quantityDesired ?? DEFAULT_QUANTITY_DESIRED,
    creatorNote: input.request.creatorNote ?? null,
    customName,
    itemStatus: ItemStatuses.AVAILABLE,
  }
}

function buildCreatedResult(written: WrittenListItem, item: ItemRowWithImage): AddItemResult {
  return {
    data: {
      listItem: {
        ...toListItemDetail(written.listItem),
        item: toItemDetail(item),
        source: written.source ? toItemSourceDetail(written.source) : null,
      },
    },
    httpStatus: HttpStatus.CREATED,
  }
}
