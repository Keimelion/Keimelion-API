import { toItemDetail } from '../../../shared/types/item.js'
import type { Item } from '../../../db/entities/items/items.schema.js'
import type { ItemDetail } from '../../../shared/types/item.js'

export interface AdminItemDetail extends ItemDetail {
  deletedAt: Date | null
}

export function toAdminItemDetail(item: Item): AdminItemDetail {
  return {
    ...toItemDetail(item),
    deletedAt: item.deletedAt ?? null,
  }
}
