import { toItemDetail, toItemSourceDetail } from '../../shared/types/item.js'
import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../db/entities/item-sources/item-sources.schema.js'
import type { Shop } from '../../db/entities/shops/shops.schema.js'
import type { ItemDetail, ItemSourceDetail } from '../../shared/types/item.js'

export interface ItemWithSources extends ItemDetail {
  sources: ItemSourceDetail[]
}

export function toItemWithSources(
  item: Item,
  sources: ItemSource[],
  shopsById: Map<string, Shop>,
): ItemWithSources {
  return {
    ...toItemDetail(item),
    sources: sources.map((source) => toItemSourceDetail(source, resolveShop(source, shopsById))),
  }
}

function resolveShop(source: ItemSource, shopsById: Map<string, Shop>): Shop | null {
  if (!source.shopId) return null
  return shopsById.get(source.shopId) ?? null
}
