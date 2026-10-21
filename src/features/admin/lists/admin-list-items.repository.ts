import { asc, count, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { listItems } from '../../../db/entities/list-items/list-items.schema.js'
import { itemSources } from '../../../db/entities/item-sources/item-sources.schema.js'
import { currencies } from '../../../db/entities/currencies/currencies.schema.js'
import type { ListItem } from '../../../db/entities/list-items/list-items.schema.js'
import type { ItemRowWithSources } from '../../../shared/types/item.js'
import { getOffset } from '../../../shared/schemas/pagination.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SupportedCurrency } from '../../../shared/enums/currency.js'

export interface AdminListItemRow extends ListItem {
  item: ItemRowWithSources
}

interface ListItemAverageRow {
  listItemId: string
  averagePrice: string
}

interface RawListItemAverageRow extends Record<string, unknown> {
  list_item_id: string
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
 * Returns an FX-normalized average source price per list_item.
 *
 * Each priced source is converted to `displayCurrency` via the USD pivot
 * `price * display.usd_rate / source.usd_rate` (`usd_rate` is "units of
 * this currency per 1 USD"), then averaged per list_item and rounded to
 * numeric(10,2). List items with no priced source yield no rows; the
 * mapper defaults them to `null`.
 */
export async function findListItemAverages(
  listItemIds: string[],
  displayCurrency: SupportedCurrency,
): Promise<ListItemAverageRow[]> {
  if (listItemIds.length === 0) return []
  const rows = await db.execute<RawListItemAverageRow>(sql`
    SELECT
      ${listItems.id} AS list_item_id,
      AVG(${itemSources.price} * display.usd_rate / source.usd_rate)::numeric(10,2) AS average_price
    FROM ${listItems}
    INNER JOIN ${itemSources}
      ON ${itemSources.itemId} = ${listItems.itemId}
     AND ${itemSources.price} IS NOT NULL
    JOIN ${currencies} source ON source.code = ${itemSources.currency}
    JOIN ${currencies} display ON display.code = ${displayCurrency}
    WHERE ${inArray(listItems.id, listItemIds)}
    GROUP BY ${listItems.id}
  `)
  return Array.from(rows).map((row) => ({
    listItemId: row.list_item_id,
    averagePrice: row.average_price,
  }))
}
