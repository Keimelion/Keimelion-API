import type { ItemSource } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { Item } from '../../../db/entities/items/items.schema.js'

export interface AdminShopItemSource {
  id: string
  itemId: string
  itemName: string
  sourceUrl: string | null
  price: string | null
  currency: string
  createdAt: Date
}

export interface ItemSourceWithItem extends ItemSource {
  item: Pick<Item, 'id' | 'name'>
}

export function toAdminShopItemSource(row: ItemSourceWithItem): AdminShopItemSource {
  return {
    id: row.id,
    itemId: row.itemId,
    itemName: row.item.name,
    sourceUrl: row.sourceUrl ?? null,
    price: row.price ?? null,
    currency: row.currency,
    createdAt: row.createdAt,
  }
}
