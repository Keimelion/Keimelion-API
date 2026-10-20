import { extractOwnerDetail, toListDetail } from '../../../shared/types/list.js'
import type { ListDetail, ListRowWithOwner } from '../../../shared/types/list.js'
import type { SupportedCurrency } from '../../../shared/enums/currency.js'

export interface AdminListAggregate {
  itemCount: number
  totalEstimatedPrice: string | null
}

export interface AdminListDetail extends ListDetail {
  deletedAt: Date | null
  itemCount: number
  totalEstimatedPrice: string | null
  displayCurrency: SupportedCurrency
}

const DEFAULT_AGGREGATE: AdminListAggregate = { itemCount: 0, totalEstimatedPrice: null }

export function toAdminListDetail(
  row: ListRowWithOwner,
  displayCurrency: SupportedCurrency,
  aggregate: AdminListAggregate = DEFAULT_AGGREGATE,
): AdminListDetail {
  return {
    ...toListDetail(row, extractOwnerDetail(row)),
    deletedAt: row.deletedAt ?? null,
    itemCount: aggregate.itemCount,
    totalEstimatedPrice: aggregate.totalEstimatedPrice,
    displayCurrency,
  }
}
