import { toItemWithSources } from '../../../shared/types/item.js'
import type { ItemRowWithSources } from '../../../shared/types/item.js'
import type {
  ItemContributionDetail,
  ItemContributionRowWithUser,
  ItemRowWithSourcesAndContributions,
} from '../../../shared/types/item-contribution.js'
import type { Locale } from '@keimelion/sdk/enums'
import type { AdminItemDetailParsed, AdminItemWithContributionsDetailParsed } from '@keimelion/sdk/schemas'

export type AdminItem = AdminItemDetailParsed

export type AdminItemWithContributions = AdminItemWithContributionsDetailParsed

export function toAdminItem(
  row: ItemRowWithSources,
  locale: Locale,
  reservationCount: number,
): AdminItem {
  return {
    ...toItemWithSources(row, locale),
    reservationCount,
  }
}

export function toAdminItemWithContributions(
  row: ItemRowWithSourcesAndContributions,
  locale: Locale,
  reservationCount: number,
): AdminItemWithContributions {
  return {
    ...toAdminItem(row, locale, reservationCount),
    contributions: row.contributions.map(toItemContributionDetail),
  }
}

function toItemContributionDetail(row: ItemContributionRowWithUser): ItemContributionDetail {
  return {
    id: row.id,
    action: row.action,
    changes: row.changes,
    user: row.user ? { id: row.user.id, username: row.user.username } : null,
    createdAt: row.createdAt,
  }
}
