import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../db/entities/item-sources/item-sources.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { ItemDetail, ItemSourceDetail, ListItemDetail } from '../../shared/types/item.js'

export interface ListItemResponse extends ListItemDetail {
  item: ItemDetail
  source: ItemSourceDetail | null
}

export function toItemDetail(item: Item): ItemDetail {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    imageUrl: item.imageUrl ?? null,
    createdByUserId: item.createdByUserId ?? null,
    moderationStatus: item.moderationStatus,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export function toItemSourceDetail(source: ItemSource): ItemSourceDetail {
  return {
    id: source.id,
    itemId: source.itemId,
    shopId: source.shopId ?? null,
    sourceUrl: source.sourceUrl ?? null,
    price: source.price ?? null,
    currency: source.currency,
    isPrimary: source.isPrimary,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  }
}

export function toListItemDetail(listItem: ListItem): ListItemDetail {
  return {
    id: listItem.id,
    listId: listItem.listId,
    itemId: listItem.itemId,
    quantityDesired: listItem.quantityDesired,
    quantityReservedTotal: listItem.quantityReservedTotal,
    itemStatus: listItem.itemStatus,
    sortOrder: listItem.sortOrder ?? null,
    creatorNote: listItem.creatorNote ?? null,
    createdAt: listItem.createdAt,
    updatedAt: listItem.updatedAt,
  }
}
