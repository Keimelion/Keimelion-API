import type { ItemDetail, ItemSourceDetail, ListItemDetail } from '../../shared/types/item.js'

export interface ListItemResponse extends ListItemDetail {
  item: ItemDetail
  source: ItemSourceDetail | null
}
