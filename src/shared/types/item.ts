import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../db/entities/item-sources/item-sources.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'

export interface ItemDetail {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  createdByUserId: string | null
  moderationStatus: string
  createdAt: Date
  updatedAt: Date
}

export interface ItemWrite {
  name: string
  description: string | null
  imageUrl: string | null
}

export interface ItemSourceDetail {
  id: string
  itemId: string
  shopId: string | null
  sourceUrl: string | null
  price: string | null
  currency: string
  isPrimary: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ListItemDetail {
  id: string
  listId: string
  itemId: string
  quantityDesired: number
  quantityReservedTotal: number
  itemStatus: string
  sortOrder: number | null
  creatorNote: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ListItemWrite {
  quantityDesired: number
  creatorNote: string | null
  sortOrder: number | null
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
