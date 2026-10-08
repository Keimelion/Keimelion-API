import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../db/entities/item-sources/item-sources.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { Shop } from '../../db/entities/shops/shops.schema.js'
import type { ShopPublic } from './shop.js'
import { toShopPublic } from './shop.js'

export interface ItemDetail {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ItemWithSources extends ItemDetail {
  sources: ItemSourceDetail[]
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
  shop: ShopPublic | null
  sourceUrl: string | null
  price: string | null
  currency: string
  createdAt: Date
  updatedAt: Date
}

export interface ItemSourceWithShop extends ItemSource {
  shop: Shop | null
}

export interface ItemRowWithSources extends Item {
  sources: ItemSourceWithShop[]
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
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export function toItemSourceDetail(source: ItemSourceWithShop): ItemSourceDetail {
  return {
    id: source.id,
    itemId: source.itemId,
    shopId: source.shopId ?? null,
    shop: source.shop ? toShopPublic(source.shop) : null,
    sourceUrl: source.sourceUrl ?? null,
    price: source.price ?? null,
    currency: source.currency,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  }
}

export function toItemSourceDetailWithoutShop(source: ItemSource): ItemSourceDetail {
  return toItemSourceDetail({ ...source, shop: null })
}

export function toItemWithSources(item: ItemRowWithSources): ItemWithSources {
  return {
    ...toItemDetail(item),
    sources: item.sources.map((source) => toItemSourceDetail(source)),
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
