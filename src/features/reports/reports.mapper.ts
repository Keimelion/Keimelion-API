import { DEFAULT_LOCALE } from '@keimelion/sdk/enums'
import { findOwnerUser, toPublicItemDetail, toPublicUserDetail } from '../../shared/types/list.js'
import { toTagPublic } from '../../shared/types/tag.js'
import type { UserRowWithAvatar } from '../../shared/types/user.js'
import type { ListRowWithOwner } from '../../shared/types/list.js'
import type { ItemRowWithSources } from '../../shared/types/item.js'

export type ReportTargetSnapshot = Record<string, unknown>

// Snapshots keep only what the target exposes publicly, field by field: account settings and
// contact data (email, consents, auth provider, activity) never reach the moderation record.
export function toUserSnapshot(user: UserRowWithAvatar): ReportTargetSnapshot {
  return toJsonSnapshot(toPublicUserDetail(user))
}

export function toListSnapshot(list: ListRowWithOwner): ReportTargetSnapshot {
  const ownerUser = findOwnerUser(list.listUsers)
  return toJsonSnapshot({
    id: list.id,
    title: list.title,
    slug: list.slug,
    description: list.description ?? null,
    listStatus: list.listStatus,
    occasionTypeId: list.occasionTypeId ?? null,
    owner: ownerUser ? toPublicUserDetail(ownerUser) : null,
    tags: list.listTags.map((link) => toTagPublic(link.tag)),
  })
}

export function toItemSnapshot(item: ItemRowWithSources): ReportTargetSnapshot {
  return toJsonSnapshot(toPublicItemDetail(item, DEFAULT_LOCALE))
}

function toJsonSnapshot(detail: object): ReportTargetSnapshot {
  return JSON.parse(JSON.stringify(detail)) as ReportTargetSnapshot
}
