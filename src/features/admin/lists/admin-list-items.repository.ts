import { asc, count, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { listItems } from '../../../db/entities/list-items/list-items.schema.js'
import { itemSources } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { ListItem } from '../../../db/entities/list-items/list-items.schema.js'
import type { ItemRowWithSources } from '../../../shared/types/item.js'
import { getOffset } from '../../../shared/schemas/pagination.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'

export interface AdminListItemRow extends ListItem {
  item: ItemRowWithSources
}

export interface ListItemCurrencyAverageRow {
  listItemId: string
  currency: string
  averagePrice: string
}

interface RawListItemAverageRow extends Record<string, unknown> {
  list_item_id: string
  currency: string
  average_price: string
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

/**
 * Returns per-(list_item, currency) average source price for the given list_item IDs.
 *
 * Only priced sources contribute (NULL prices are filtered via the INNER JOIN
 * predicate `price IS NOT NULL`). List items with no priced source yield no rows;
 * the mapper defaults them to an empty object.
 */
export async function findListItemAveragesByCurrency(
  listItemIds: string[],
): Promise<ListItemCurrencyAverageRow[]> {
  if (listItemIds.length === 0) return []
  const rows = await db.execute<RawListItemAverageRow>(sql`
    SELECT
      ${listItems.id} AS list_item_id,
      ${itemSources.currency} AS currency,
      AVG(${itemSources.price})::numeric(10,2) AS average_price
    FROM ${listItems}
    INNER JOIN ${itemSources}
      ON ${itemSources.itemId} = ${listItems.itemId}
     AND ${itemSources.price} IS NOT NULL
    WHERE ${inArray(listItems.id, listItemIds)}
    GROUP BY ${listItems.id}, ${itemSources.currency}
  `)
  return Array.from(rows).map((row) => ({
    listItemId: row.list_item_id,
    currency: row.currency,
    averagePrice: row.average_price,
  }))
}
