import { toItemDetail, toItemSourceDetail } from '../../shared/types/item.js'
import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../db/entities/item-sources/item-sources.schema.js'
import type { ItemDetail, ItemSourceDetail } from '../../shared/types/item.js'

export interface ItemWithSources extends ItemDetail {
  sources: ItemSourceDetail[]
}

export function toItemWithSources(item: Item, sources: ItemSource[]): ItemWithSources {
  return {
    ...toItemDetail(item),
    sources: sources.map(toItemSourceDetail),
  }
}
