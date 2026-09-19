import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { BaseListItem } from '../../shared/types/item.js'

export function toBaseListItemFromRow(listItem: ListItem): BaseListItem {
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
