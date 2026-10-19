import { asc, count, eq, sql } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { listItems } from '../../../db/entities/list-items/list-items.schema.js'
import type { ListItem } from '../../../db/entities/list-items/list-items.schema.js'
import type { ItemRowWithSources } from '../../../shared/types/item.js'
import { getOffset } from '../../../shared/schemas/pagination.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'

export interface AdminListItemRow extends ListItem {
  item: ItemRowWithSources
}

export function findListItemsByListIdPaged(
  listId: string,
  pagination: PaginationInput,
): Promise<AdminListItemRow[]> {
  const offset = getOffset(pagination)
  return db.query.listItems.findMany({
    where: eq(listItems.listId, listId),
    orderBy: [sql`${listItems.sortOrder} ASC NULLS LAST`, asc(listItems.createdAt)],
    limit: pagination.limit,
    offset,
    with: {
      item: {
        with: {
          sources: { with: { shop: true } },
          itemCategories: { with: { category: { with: { translations: true } } } },
          itemTags: { with: { tag: true } },
        },
      },
    },
  })
}

export async function countListItemsByListId(listId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(listItems)
    .where(eq(listItems.listId, listId))
  return row?.count ?? 0
}
