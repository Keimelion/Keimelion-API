import { DEFAULT_LOCALE } from '@keimelion/sdk/enums'
import { toUserDetail } from '../../shared/types/user.js'
import { toListDetail } from '../../shared/types/list.js'
import { toItemWithSources } from '../../shared/types/item.js'
import type { UserRowWithAvatar } from '../../shared/types/user.js'
import type { ListRowWithOwner } from '../../shared/types/list.js'
import type { ItemRowWithSources } from '../../shared/types/item.js'

export type ReportTargetSnapshot = Record<string, unknown>

const SNAPSHOT_EXCLUDED_KEYS: ReadonlySet<string> = new Set(['email'])

export function toUserSnapshot(user: UserRowWithAvatar): ReportTargetSnapshot {
  return serializeSnapshot(toUserDetail(user))
}

export function toListSnapshot(list: ListRowWithOwner): ReportTargetSnapshot {
  return serializeSnapshot(toListDetail(list))
}

export function toItemSnapshot(item: ItemRowWithSources): ReportTargetSnapshot {
  return serializeSnapshot(toItemWithSources(item, DEFAULT_LOCALE))
}

function serializeSnapshot(detail: object): ReportTargetSnapshot {
  const json = JSON.stringify(detail, (key, value: unknown) =>
    SNAPSHOT_EXCLUDED_KEYS.has(key) ? undefined : value,
  )
  return JSON.parse(json) as ReportTargetSnapshot
}
