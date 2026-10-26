import { and, count, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/client.js'
import { lists } from '../../../db/entities/lists/lists.schema.js'
import { listCollaborators } from '../../../db/entities/list-collaborators/list-collaborators.schema.js'
import { listItems } from '../../../db/entities/list-items/list-items.schema.js'
import { itemSources } from '../../../db/entities/item-sources/item-sources.schema.js'
import { currencies } from '../../../db/entities/currencies/currencies.schema.js'
import type { SupportedCurrency } from '../../../shared/enums/currency.js'
import {
  LIST_DEFAULT_SORT,
  LIST_SORTABLE_FIELDS,
  LIST_WITH_OWNER,
  findListById,
  findListWithOwner,
} from '../../../db/entities/lists/lists.repository.js'
import { CollabRoles } from '../../../shared/enums/collab-role.js'
import { defineEntity, buildSoftDeleteDefault } from '../../../shared/db/entity-descriptor.js'
import { LIST_STATUS_VALUES } from '../../../shared/enums/list-status.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { ListRowWithOwner } from '../../../shared/types/list.js'
import { getOffset } from '../../../shared/schemas/pagination.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'

const listStatusSchema = z.enum(LIST_STATUS_VALUES)
const occasionTypeIdSchema = z.string().uuid()

export const listsEntity = defineEntity({
  sortable: LIST_SORTABLE_FIELDS,
  defaultSort: LIST_DEFAULT_SORT,
  filterable: {
    id:             { column: lists.id,             operators: ['eq', 'in'] },
    title:          { column: lists.title,          operators: ['eq', 'ilike'] },
    listStatus:     { column: lists.listStatus,     operators: ['eq', 'in'],   valueSchema: listStatusSchema },
    occasionTypeId: { column: lists.occasionTypeId, operators: ['eq', 'isNull'], valueSchema: occasionTypeIdSchema },
    createdAt:      { column: lists.createdAt, operators: ['gte', 'lte', 'between'], valueType: 'date' },
    updatedAt:      { column: lists.updatedAt, operators: ['gte', 'lte', 'between'], valueType: 'date' },
    deletedAt:      { column: lists.deletedAt, operators: ['isNull'] },
  },
})

export type ListsSortField = keyof typeof listsEntity.sortable

export interface ListListsFilters {
  sort?: SortInput<ListsSortField> | undefined
  genericFilters?: FilterInput[] | undefined
  ownerListIds?: string[] | undefined
}

export function findAllListsWithOwner(
  input: PaginationInput,
  filters: ListListsFilters,
): Promise<ListRowWithOwner[]> {
  const offset = getOffset(input)
  return db.query.lists.findMany({
    where: buildListsWhere(filters),
    orderBy: listsEntity.buildOrderBy(filters.sort),
    limit: input.limit,
    offset,
    with: LIST_WITH_OWNER,
  })
}

export async function countLists(filters: ListListsFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(lists)
    .where(buildListsWhere(filters))
  return row?.count ?? 0
}

export function findAdminListById(id: string): Promise<List | undefined> {
  return findListById(id, { includeDeleted: true })
}

export function findAdminListByIdWithOwner(id: string): Promise<ListRowWithOwner | undefined> {
  return findListWithOwner(id)
}

interface ListAggregateRawRow {
  listId: string
  itemCount: number
  totalEstimatedPrice: string | null
}

interface RawAggregateRow extends Record<string, unknown> {
  list_id: string
  item_count: number | string
  total_estimated_price: string | null
}

/**
 * Returns `itemCount` and an FX-normalized `totalEstimatedPrice` per list.
 *
 * Each list_item's priced sources are first averaged (grouped by the
 * source's own currency) in `item_averages_by_currency`; the LEFT JOIN
 * with `price IS NOT NULL` preserves list_items without any priced
 * source so they still contribute to `itemCount`. Each per-currency
 * average is then converted to `displayCurrency` via the USD pivot
 * `amount_in_D = amount * display.usd_rate / source.usd_rate`
 * (`usd_rate` is "units of this currency per 1 USD"), summed per list,
 * and rounded to numeric(10,2).
 *
 * Lists with zero list_items are absent; the service defaults them to
 * `{ itemCount: 0, totalEstimatedPrice: null }`. Lists with items but no
 * priced source emit `total_estimated_price = NULL`.
 */
export async function findListAggregatesByIds(
  listIds: string[],
  displayCurrency: SupportedCurrency,
): Promise<ListAggregateRawRow[]> {
  if (listIds.length === 0) return []
  const rows = await db.execute<RawAggregateRow>(sql`
    WITH item_averages_by_currency AS (
      SELECT
        ${listItems.listId} AS list_id,
        ${listItems.id} AS list_item_id,
        ${itemSources.currency} AS currency,
        AVG(${itemSources.price}) AS item_avg
      FROM ${listItems}
      LEFT JOIN ${itemSources}
        ON ${itemSources.itemId} = ${listItems.itemId}
       AND ${itemSources.price} IS NOT NULL
      WHERE ${inArray(listItems.listId, listIds)}
      GROUP BY ${listItems.listId}, ${listItems.id}, ${itemSources.currency}
    ),
    item_counts AS (
      SELECT list_id, COUNT(DISTINCT list_item_id)::int AS item_count
      FROM item_averages_by_currency
      GROUP BY list_id
    ),
    list_totals AS (
      SELECT
        iabc.list_id,
        SUM(iabc.item_avg * display.usd_rate / source.usd_rate)::numeric(10,2) AS total_estimated_price
      FROM item_averages_by_currency iabc
      JOIN ${currencies} source ON source.code = iabc.currency
      JOIN ${currencies} display ON display.code = ${displayCurrency}
      WHERE iabc.currency IS NOT NULL
      GROUP BY iabc.list_id
    )
    SELECT
      ic.list_id,
      ic.item_count,
      lt.total_estimated_price
    FROM item_counts ic
    LEFT JOIN list_totals lt ON lt.list_id = ic.list_id
  `)
  return Array.from(rows).map((row) => ({
    listId: row.list_id,
    itemCount: Number(row.item_count),
    totalEstimatedPrice: row.total_estimated_price,
  }))
}

export async function findListIdsByOwnerUserId(ownerUserId: string): Promise<string[]> {
  const rows = await db
    .select({ listId: listCollaborators.listId })
    .from(listCollaborators)
    .where(and(eq(listCollaborators.userId, ownerUserId), eq(listCollaborators.collabRole, CollabRoles.OWNER)))
  return rows.map((row) => row.listId)
}

function buildListsWhere(filters: ListListsFilters): SQL | undefined {
  const generic = filters.genericFilters ?? []
  const genericClause = generic.length > 0 ? listsEntity.buildWhere(generic) : undefined
  const ownerClause = filters.ownerListIds !== undefined ? inArray(lists.id, filters.ownerListIds) : undefined
  return and(buildSoftDeleteDefault(generic, lists.deletedAt), genericClause, ownerClause)
}
