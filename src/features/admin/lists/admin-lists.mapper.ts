import { extractOwnerDetail, toListDetailWithoutCollaborators } from '../../../shared/types/list.js'
import type { ListRowWithOwner } from '../../../shared/types/list.js'
import type { AdminListDetailParsed } from '@keimelion/sdk/schemas'
import type { SupportedCurrency } from '@keimelion/sdk/enums'

export interface AdminListAggregate {
  itemCount: number
  totalEstimatedPrice: string | null
}

export type AdminListDetail = AdminListDetailParsed

const DEFAULT_AGGREGATE: AdminListAggregate = { itemCount: 0, totalEstimatedPrice: null }

export function toAdminListDetail(
  row: ListRowWithOwner,
  displayCurrency: SupportedCurrency,
  aggregate: AdminListAggregate = DEFAULT_AGGREGATE,
): AdminListDetail {
  return {
    ...toListDetailWithoutCollaborators(row),
    owner: extractOwnerDetail(row),
    deletedAt: row.deletedAt ?? null,
    itemCount: aggregate.itemCount,
    totalEstimatedPrice: aggregate.totalEstimatedPrice,
    displayCurrency,
  }
}
