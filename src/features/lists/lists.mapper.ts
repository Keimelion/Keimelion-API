import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../db/entities/item-sources/item-sources.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { BaseItem, BaseItemSource, BaseListItem } from '../../shared/types/item.js'

export interface ListItemResponse extends BaseListItem {
  item: BaseItem
  source: BaseItemSource | null
}

export function toBaseItem(item: Item): BaseItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    imageUrl: item.imageUrl ?? null,
    locale: item.locale,
    createdByUserId: item.createdByUserId ?? null,
    moderationStatus: item.moderationStatus,
    addCount: item.addCount,
    reserveCount: item.reserveCount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export function toBaseItemSource(source: ItemSource): BaseItemSource {
  return {
    id: source.id,
    itemId: source.itemId,
    shopName: source.shopName ?? null,
    sourceUrl: source.sourceUrl ?? null,
    price: source.price ?? null,
    currency: source.currency,
    affiliatePartner: source.affiliatePartner ?? null,
    affiliateUrl: source.affiliateUrl ?? null,
    isDomainTrusted: source.isDomainTrusted,
    isPrimary: source.isPrimary,
    addedVia: source.addedVia ?? null,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  }
}

export function toBaseListItem(listItem: ListItem): BaseListItem {
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
