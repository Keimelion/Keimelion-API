import { asc, count, eq, sql } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { listItems } from '../../../db/entities/list-items/list-items.schema.js'
import type { Item } from '../../../db/entities/items/items.schema.js'
import type { ListItem } from '../../../db/entities/list-items/list-items.schema.js'
import type { ItemSourceWithShop } from '../../../shared/types/item.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'

export interface ItemWithSourcesRow extends Item {
  sources: ItemSourceWithShop[]
}

export interface AdminListItemRow extends ListItem {
  item: ItemWithSourcesRow
}

export function findListItemsByListIdPaged(
  listId: string,
  pagination: PaginationInput,
): Promise<AdminListItemRow[]> {
  const offset = (pagination.page - 1) * pagination.limit
  return db.query.listItems.findMany({
    where: eq(listItems.listId, listId),
    orderBy: [sql`${listItems.sortOrder} ASC NULLS LAST`, asc(listItems.createdAt)],
    limit: pagination.limit,
    offset,
    with: { item: { with: { sources: { with: { shop: true } } } } },
  })
}

export async function countListItemsByListId(listId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(listItems)
    .where(eq(listItems.listId, listId))
  return row?.count ?? 0
}
