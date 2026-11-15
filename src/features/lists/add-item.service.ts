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
import { isPgUniqueViolation } from '../../shared/db/pg-errors.js'
import { resolveItemRelations, writeItemRelations } from '../../shared/db/item-relations.js'
import { resolveSourceShop } from '../../shared/db/source-shops.js'
import {
  findItemByGtinWithImage,
  findItemByIdWithImage,
  insertItem,
} from '../../db/entities/items/items.repository.js'
import {
  findItemSourceBySourceUrl,
  insertItemSource,
  insertItemSourceIfAbsent,
} from '../../db/entities/item-sources/item-sources.repository.js'
import {
  findListItemByListAndItem,
  insertListItemIfAbsent,
} from '../../db/entities/list-items/list-items.repository.js'
import { toItemDetail, toItemSourceDetail, toListItemDetail } from '../../shared/types/item.js'
import { normalizeSourceUrl } from '../affiliate/affiliate.service.js'
import { processOptionalImage, runWithImageRollback } from '../uploads/images.service.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { Shop } from '../../db/entities/shops/shops.schema.js'
import type { InsertItemSourceInput } from '../../db/entities/item-sources/item-sources.repository.js'
import type { ItemRelations } from '../../shared/db/item-relations.js'
import type { ItemRowWithImage, ItemSourceWithShop } from '../../shared/types/item.js'
import type { SourceUrlFields } from '../affiliate/affiliate.service.js'
import type { ListItemResponse } from './lists.types.js'
import type { ServiceResult } from '../../shared/types/service.js'

export interface AddItemToListInput {
  listId: string
  userId: string
  request: ListsAddItemRequestParsed
  imageBuffer: Buffer | null
}

type AddItemResult = ServiceResult<{ listItem: ListItemResponse }>
type SourceWrite = Omit<InsertItemSourceInput, 'itemId'>

interface ResolvedSourceUrl {
  shop: Shop | null
  normalizedUrl: string
  urlFields: SourceUrlFields
}

interface SourcePlan {
  existing: ItemSourceWithShop | null
  toAttach: SourceWrite | null
  shop: Shop | null
}

interface KnownItemLink {
  item: ItemRowWithImage
  customName: string | null
  sourcePlan: SourcePlan
}

interface ProductLookup {
  item: ItemRowWithImage
  urlHolder: ItemSourceWithShop | null
}

interface WrittenListItem {
  listItem: ListItem
  source: ItemSourceWithShop | null
}

const DEFAULT_QUANTITY_DESIRED = 1
const ADD_PRODUCT_CONTEXT = 'list.add-product'
const NO_SOURCE_PLAN: SourcePlan = { existing: null, toAttach: null, shop: null }

export async function addItemToList(input: AddItemToListInput): Promise<AddItemResult> {
  const sourceUrl = await resolveSourceUrl(input.request.sourceUrl)
  if ('itemId' in input.request) return addItemById(input, input.request, sourceUrl)
  return addProduct(input, input.request, sourceUrl)
}

async function resolveSourceUrl(submittedUrl: string | undefined): Promise<ResolvedSourceUrl | null> {
  if (submittedUrl === undefined) return null
  const shop = await resolveSourceShop({ shopId: null, sourceUrl: submittedUrl })
  const normalizedUrl = normalizeSourceUrl(submittedUrl, shop?.slug ?? null)
  return {
    shop,
    normalizedUrl,
    urlFields: { sourceUrl: normalizedUrl, originalUrl: submittedUrl, affiliateUrl: null },
  }
}

async function addItemById(
  input: AddItemToListInput,
  request: ListsAddItemByIdRequestParsed,
  sourceUrl: ResolvedSourceUrl | null,
): Promise<AddItemResult> {
  const item = await findItemByIdWithImage(request.itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)

  const urlHolder = sourceUrl === null ? null : (await findItemSourceBySourceUrl(sourceUrl.normalizedUrl)) ?? null
  return linkKnownItem(input, {
    item,
    customName: request.customName ?? null,
    sourcePlan: planSourceForKnownItem(item.id, sourceUrl, urlHolder),
  })
}

async function addProduct(
  input: AddItemToListInput,
  product: ListsAddProductRequestParsed,
  sourceUrl: ResolvedSourceUrl | null,
): Promise<AddItemResult> {
  const known = await findKnownProduct(product, sourceUrl)
  if (known) return linkKnownProduct(input, { product, sourceUrl, known })

  const created = await createProduct(input, product, sourceUrl)
  if (created !== null) return created

  const concurrentlyCreated = await findKnownProduct(product, sourceUrl)
  if (!concurrentlyCreated) return serviceError(ErrorCode.INTERNAL_ERROR)
  return linkKnownProduct(input, { product, sourceUrl, known: concurrentlyCreated })
}

// Matching never uses the name: a product without URL nor GTIN is always a new item.
async function findKnownProduct(
  product: ListsAddProductRequestParsed,
  sourceUrl: ResolvedSourceUrl | null,
): Promise<ProductLookup | null> {
  const urlHolder = sourceUrl === null ? undefined : await findItemSourceBySourceUrl(sourceUrl.normalizedUrl)
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
    sourcePlan: planSourceForKnownItem(known.item.id, sourceUrl, known.urlHolder),
  })
}

function resolveKnownProductCustomName(product: ListsAddProductRequestParsed, item: ItemRowWithImage): string | null {
  if (product.customName !== undefined) return product.customName
  return product.name === item.name ? null : product.name
}

// A known item only receives a URL resolving to a known shop and held by no source yet: sources
// without a shop have no uniqueness limit and would show on other users' public lists.
function planSourceForKnownItem(
  itemId: string,
  sourceUrl: ResolvedSourceUrl | null,
  urlHolder: ItemSourceWithShop | null,
): SourcePlan {
  if (urlHolder !== null) return { ...NO_SOURCE_PLAN, existing: urlHolder.itemId === itemId ? urlHolder : null }
  if (!sourceUrl?.shop) return NO_SOURCE_PLAN

  const { shop, urlFields } = sourceUrl
  return {
    existing: null,
    toAttach: { shopId: shop.id, ...urlFields, price: null, currency: DEFAULT_SOURCE_CURRENCY },
    shop,
  }
}

async function linkKnownItem(input: AddItemToListInput, link: KnownItemLink): Promise<AddItemResult> {
  const { item, customName, sourcePlan } = link
  const outcome = await db.transaction(async (tx) => {
    const listItem = await insertListItemIfAbsent(buildListItemValues(input, item.id, customName), tx)
    if (!listItem) return { duplicate: await findListItemByListAndItem(input.listId, item.id, tx) }
    return { written: { listItem, source: await attachSource(item.id, sourcePlan, tx) } }
  })

  if ('duplicate' in outcome) return listItemAlreadyExists(outcome.duplicate)
  return buildCreatedResult(outcome.written, item)
}

// The insert is skipped on any unique conflict (shop already on the item, URL taken concurrently):
// the list item is still added, without a new source.
async function attachSource(itemId: string, plan: SourcePlan, tx: DbTransaction): Promise<ItemSourceWithShop | null> {
  if (plan.toAttach === null) return plan.existing
  const attached = await insertItemSourceIfAbsent({ itemId, ...plan.toAttach }, tx)
  return attached ? { ...attached, shop: plan.shop } : null
}

function listItemAlreadyExists(existing: ListItem | undefined): AddItemResult {
  if (!existing) return serviceError(ErrorCode.CONFLICT)
  const metadata: ListItemAlreadyExistsMetadataParsed = {
    listItemId: existing.id,
    quantityDesired: existing.quantityDesired,
  }
  return serviceError(ErrorCode.LIST_ITEM_ALREADY_EXISTS, metadata)
}

// Returns null when a concurrent request created the same product first (unique URL or GTIN).
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
    if (isPgUniqueViolation(error)) return null
    throw error
  }
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
  const { product, sourceUrl } = newProduct
  if (sourceUrl === null) return null

  const source = await insertItemSource(
    { itemId, shopId: sourceUrl.shop?.id ?? null, ...sourceUrl.urlFields, price: product.price ?? null, currency: product.currency },
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
