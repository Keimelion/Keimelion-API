import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { scrapeOgData } from '../../shared/utils/og-scraper.js'
import { insertItem } from '../../db/entities/items/items.repository.js'
import { insertItemSource } from '../../db/entities/item-sources/item-sources.repository.js'
import { insertListItem } from '../../db/entities/list-items/list-items.repository.js'
import { findListById } from '../../db/entities/lists/lists.repository.js'
import { findListOwner } from '../../db/entities/list-collaborators/list-collaborators.repository.js'
import { toBaseItem, toBaseListItem, toBaseItemSource } from './lists.mapper.js'
import type { ListItemResponse } from './lists.mapper.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { AddItemInput } from './endpoints/add-item.js'
import type { AddItemFromUrlInput } from './endpoints/add-item-from-url.js'

const DEFAULT_LOCALE = 'fr'
const DEFAULT_MODERATION_STATUS = 'approved'
const DEFAULT_ITEM_STATUS = 'available'
const DEFAULT_QUANTITY_DESIRED = 1
const OG_ADDED_VIA = 'url'

export async function addItemToList(
  listId: string,
  userId: string,
  input: AddItemInput,
): Promise<ServiceResult<{ listItem: ListItemResponse }>> {
  const ownershipResult = await resolveListOwnership(listId, userId)
  if (ownershipResult) return ownershipResult

  const item = await insertItem({
    name: input.name,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    locale: DEFAULT_LOCALE,
    createdByUserId: userId,
    moderationStatus: DEFAULT_MODERATION_STATUS,
  })

  if (!item) {
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  const source = input.price !== undefined
    ? await insertItemSource({
        itemId: item.id,
        shopName: null,
        sourceUrl: null,
        price: String(input.price),
        currency: 'EUR',
        isPrimary: true,
        addedVia: null,
      })
    : undefined

  const listItem = await insertListItem({
    listId,
    itemId: item.id,
    quantityDesired: input.quantityDesired ?? DEFAULT_QUANTITY_DESIRED,
    creatorNote: input.creatorNote ?? null,
    itemStatus: DEFAULT_ITEM_STATUS,
  })

  if (!listItem) {
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  return {
    data: {
      listItem: {
        ...toBaseListItem(listItem),
        item: toBaseItem(item),
        source: source ? toBaseItemSource(source) : null,
      },
    },
    httpStatus: HttpStatus.CREATED,
  }
}

export async function addItemFromUrl(
  listId: string,
  userId: string,
  input: AddItemFromUrlInput,
): Promise<ServiceResult<{ listItem: ListItemResponse }>> {
  const ownershipResult = await resolveListOwnership(listId, userId)
  if (ownershipResult) return ownershipResult

  const ogData = await scrapeOgData(input.url)

  const item = await insertItem({
    name: ogData.title ?? input.url,
    description: null,
    imageUrl: ogData.image,
    locale: DEFAULT_LOCALE,
    createdByUserId: userId,
    moderationStatus: DEFAULT_MODERATION_STATUS,
  })

  if (!item) {
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  const source = await insertItemSource({
    itemId: item.id,
    shopName: null,
    sourceUrl: input.url,
    price: ogData.price,
    currency: 'EUR',
    isPrimary: true,
    addedVia: OG_ADDED_VIA,
  })

  const listItem = await insertListItem({
    listId,
    itemId: item.id,
    quantityDesired: DEFAULT_QUANTITY_DESIRED,
    creatorNote: null,
    itemStatus: DEFAULT_ITEM_STATUS,
  })

  if (!listItem) {
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  return {
    data: {
      listItem: {
        ...toBaseListItem(listItem),
        item: toBaseItem(item),
        source: source ? toBaseItemSource(source) : null,
      },
    },
    httpStatus: HttpStatus.CREATED,
  }
}

async function resolveListOwnership(listId: string, userId: string): Promise<ServiceResult<never> | null> {
  const list = await findListById(listId)

  if (!list || list.deletedAt) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  const owner = await findListOwner(listId, userId)

  if (!owner) {
    return serviceError(ErrorCode.FORBIDDEN)
  }

  return null
}
