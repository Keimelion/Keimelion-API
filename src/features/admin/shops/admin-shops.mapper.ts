import type { ItemSource } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { Item } from '../../../db/entities/items/items.schema.js'
import type { AdminShopItemSourceSummaryParsed } from '@keimelion/sdk/schemas'

export type AdminShopItemSource = AdminShopItemSourceSummaryParsed

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
