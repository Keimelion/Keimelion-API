import { toItemDetail, toItemSourceDetail } from '../../../shared/types/item.js'
import type { Item } from '../../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { ItemDetail, ItemSourceDetail } from '../../../shared/types/item.js'

export interface AdminItemDetail extends ItemDetail {
  deletedAt: Date | null
  sources: ItemSourceDetail[]
}

export function toAdminItemDetail(item: Item, sources: ItemSource[]): AdminItemDetail {
  return {
    ...toItemDetail(item),
    deletedAt: item.deletedAt ?? null,
    sources: sources.map(toItemSourceDetail),
  }
}
