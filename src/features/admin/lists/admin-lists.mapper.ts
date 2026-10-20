import { extractOwnerDetail, toListDetail } from '../../../shared/types/list.js'
import type { ListDetail, ListRowWithOwner } from '../../../shared/types/list.js'
import type { SupportedCurrency } from '../../../shared/enums/currency.js'

export type CurrencyTotals = Partial<Record<SupportedCurrency, string>>

export interface AdminListAggregate {
  itemCount: number
  totalEstimatedPrice: CurrencyTotals
}

export interface AdminListDetail extends ListDetail {
  deletedAt: Date | null
  itemCount: number
  totalEstimatedPrice: CurrencyTotals
}

const DEFAULT_AGGREGATE: AdminListAggregate = { itemCount: 0, totalEstimatedPrice: {} }

export function toAdminListDetail(
  row: ListRowWithOwner,
  aggregate: AdminListAggregate = DEFAULT_AGGREGATE,
): AdminListDetail {
  return {
    ...toListDetail(row, extractOwnerDetail(row)),
    deletedAt: row.deletedAt ?? null,
    itemCount: aggregate.itemCount,
    totalEstimatedPrice: aggregate.totalEstimatedPrice,
  }
}
